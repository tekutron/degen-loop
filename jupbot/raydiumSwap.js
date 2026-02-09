// Raydium Trade API swap helper
// Notes:
// - amount in base units (lamports)
// - slippageBps in basis points
// - txVersion: 'V0' | 'LEGACY'
// - Uses Raydium auto-fee with cap 25,000 microLamports; falls back to solanacompass
// - Handles wrap/unwrap SOL via flags; omits token accounts for SOL

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Connection, PublicKey, VersionedTransaction, Transaction } = require('@solana/web3.js');

const API = {
  computeIn: 'https://transaction-v1.raydium.io/compute/swap-base-in',
  computeOut: 'https://transaction-v1.raydium.io/compute/swap-base-out',
  txIn: 'https://transaction-v1.raydium.io/transaction/swap-base-in',
  txOut: 'https://transaction-v1.raydium.io/transaction/swap-base-out',
  autoFee: 'https://api-v3.raydium.io/main/auto-fee',
};

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

async function getAutoPriorityMicroLamports(tier = 'vh') {
  // tier: 'vh' | 'h' | 'm'
  try {
    const { data } = await axios.get(API.autoFee, { timeout: 5000 });
    let micro = data?.default?.[tier] ?? data?.[tier] ?? data?.default?.vh;
    if (typeof micro === 'string') micro = Number(micro);
    if (typeof micro === 'number' && Number.isFinite(micro) && micro > 0) {
      return Math.min(Math.ceil(micro), 25000);
    }
  } catch {}
  // Fallback: solanacompass approx micros-per-cu
  try {
    const { data } = await axios.get(`https://solanacompass.com/api/fees?cacheFreshTime=${5 * 60 * 1000}`, { timeout: 5000 });
    const avg = data?.[15]?.avg; // 15 = ~last 15m avg
    if (avg) {
      // convert lamports per sig to microLamports per CU heuristic
      return Math.min(Math.ceil((avg * 1e6) / 600000), 25000);
    }
  } catch {}
  return 5000; // conservative default
}

async function computeQuote({ side = 'in', inputMint, outputMint, amount, slippageBps, txVersion = 'V0' }) {
  const url = side === 'in' ? API.computeIn : API.computeOut;
  const params = { inputMint, outputMint, amount: String(amount), slippageBps: String(slippageBps), txVersion };
  const resp = await axios.get(url, { params, timeout: 10000 });
  if (!resp || !resp.data) throw new Error('No compute response');
  return resp.data; // full envelope { id, success, version, data }
}

function isSol(m) { return m === WSOL_MINT; }

async function buildTransactions({ side = 'in', swapResponse, owner, txVersion = 'V0', wrapSol = false, unwrapSol = false, inputMint, outputMint, inputAccount, outputAccount, computeUnitPriceMicroLamports }) {
  const url = side === 'in' ? API.txIn : API.txOut;
  // Per docs, send swapResponse.data (not full envelope). Fallback to envelope for backward compat.
  const sr = swapResponse && swapResponse.data ? swapResponse.data : swapResponse;
  const post = {
    computeUnitPriceMicroLamports: String(computeUnitPriceMicroLamports),
    swapResponse: sr,
    txVersion,
    wallet: owner.toBase58(),
  };
  // Only pass token accounts when the mint is not SOL
  if (!isSol(inputMint) && inputAccount) post.inputAccount = inputAccount;
  if (!isSol(outputMint) && outputAccount) post.outputAccount = outputAccount;
  if (wrapSol) post.wrapSol = true;
  if (unwrapSol) post.unwrapSol = true;

  try {
    const resp = await axios.post(url, post, { timeout: 20000 });
    const body = resp && resp.data;
    // Accept either array or envelope with data array
    const arr = Array.isArray(body) ? body : (body && Array.isArray(body.data) ? body.data : null);
    if (!arr || arr.length === 0) {
      const msg = body && (body.msg || JSON.stringify(body));
      throw new Error(msg ? `No transaction payloads: ${msg}` : 'No transaction payloads');
    }
    return arr;
  } catch (e) {
    const r = e && e.response && e.response.data;
    const msg = r && (r.msg || JSON.stringify(r));
    throw new Error(msg || e.message);
  }
}

function deserializeTx(base64, txVersion) {
  const raw = Buffer.from(base64, 'base64');
  if (txVersion === 'V0') return VersionedTransaction.deserialize(raw);
  return Transaction.from(raw);
}

async function sendAndConfirmAll(connection, txs, signers) {
  const sigs = [];
  const latest = await connection.getLatestBlockhash();
  for (const tx of txs) {
    if (tx instanceof VersionedTransaction) {
      // v0: signatures expected to be added via signers (Keypair array)
      if (Array.isArray(signers) && signers.length) tx.sign(signers);
      const sig = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
      sigs.push(sig);
    } else {
      // LEGACY
      if (Array.isArray(signers) && signers.length) tx.sign(...signers);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
      sigs.push(sig);
    }
  }
  return sigs;
}

async function executeSwap({
  rpcUrl,
  ownerKeypair,
  side = 'in',
  inputMint,
  outputMint,
  amount,
  slippageBps = 50,
  txVersion = 'V0',
  wrapSol = false,
  unwrapSol = false,
  inputAccount,
  outputAccount,
  priorityTier = 'vh',
}) {
  const connection = new Connection(rpcUrl, 'confirmed');
  const owner = ownerKeypair.publicKey;
  const swapResponse = await computeQuote({ side, inputMint, outputMint, amount, slippageBps, txVersion });
  const micro = await getAutoPriorityMicroLamports(priorityTier);
  const arr = await buildTransactions({ side, swapResponse, owner, txVersion, wrapSol, unwrapSol, inputMint, outputMint, inputAccount, outputAccount, computeUnitPriceMicroLamports: micro });

  const txs = arr.map(v => deserializeTx(v.transaction || v, txVersion));
  const sigs = await sendAndConfirmAll(connection, txs, [ownerKeypair]);
  return sigs;
}

// Example CLIs and usage when run directly (disabled by default)
if (require.main === module) {
  (async () => {
    const WALLET = process.env.SWAP_WALLET || path.join(__dirname, 'wallets', 'test_swap_keypair.json');
    const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    const { Keypair } = require('@solana/web3.js');
    const secret = JSON.parse(fs.readFileSync(WALLET, 'utf8'));
    const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
    // Safety: require explicit confirmation to use a funded/main wallet
    if (process.env.MAIN_WALLET !== '1') {
      throw new Error('MAIN_WALLET not confirmed. Set MAIN_WALLET=1 to proceed with a funded wallet.');
    }

    const inputMint = WSOL_MINT;
    const outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    const amount = Math.floor(0.005 * 1_000_000_000); // lamports

    const sigs = await executeSwap({
      rpcUrl: RPC,
      ownerKeypair: kp,
      side: 'in',
      inputMint,
      outputMint,
      amount,
      slippageBps: 50,
      txVersion: 'V0',
      wrapSol: true, // wrap input SOL
      unwrapSol: false,
      priorityTier: 'vh',
    });
    console.log('Sent:', sigs);
  })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { executeSwap, getAutoPriorityMicroLamports, computeQuote, buildTransactions };
