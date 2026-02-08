// Raydium SDK-based swap runner (ESM)
// Supports CLMM, CPMM, and Raydium AMM v4 (legacy Liquidity v4)
// Route is discovered via Raydium Trade API compute endpoint.

import fs from 'fs';
import axios from 'axios';
import BN from 'bn.js';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
function loadEnvFile(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) {
        const k = m[1];
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch {}
}
loadEnvFile(path.join(HERE, '.env'));

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
  TransactionMessage,
} from '@solana/web3.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retryRpc(fn, { tries = 6, baseMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      const msg = (e && (e.message || e.toString())) || '';
      const is429 = msg.includes('429') || msg.includes('Too Many Requests');
      const isRate = is429 || msg.includes('rate') || msg.includes('throttle');
      if (i < tries - 1 && isRate) {
        const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 150);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

// 0x (ZeroEx) helpers (Solana)
function getZeroExBase() {
  return process.env.ZEROX_BASE || 'https://api.0x.org/swap/solana';
}
function getZeroExHeaders() {
  const h = { 'user-agent': 'jupbot/1.0 (+sdkSwap)' };
  if (process.env.ZEROX_API_KEY) h['0x-api-key'] = process.env.ZEROX_API_KEY;
  return h;
}
async function zeroExQuote({ inputMint, outputMint, amount, slippageBps, taker }) {
  const url = getZeroExBase() + '/quote';
  const params = {
    sellToken: inputMint,
    buyToken: outputMint,
    sellAmount: String(amount), // raw units
    slippageBps: String(slippageBps ?? 100),
    taker: taker,
    intentOnFilling: 'true',
  };
  const { data } = await axios.get(url, { params, timeout: 12000, headers: getZeroExHeaders() });
  if (!data) throw new Error('0x: no quote');
  return data; // expect { quoteId?, ... , tx?, instructions? }
}
async function zeroExBuild({ quote, taker }) {
  // Try build endpoint first
  const buildUrl = getZeroExBase() + '/build';
  try {
    const { data } = await axios.post(buildUrl, { ...quote, taker }, { timeout: 15000, headers: getZeroExHeaders() });
    if (data?.transaction) return { txBase64: data.transaction };
    if (data?.instructions) return { instructions: data.instructions, addressLookupTableAddresses: data.addressLookupTableAddresses };
  } catch (e) {
    // fall through to instructions endpoint
  }
  // Fallback: instructions endpoint
  const instUrl = getZeroExBase() + '/swap-instructions';
  const { data } = await axios.post(instUrl, { ...quote, taker }, { timeout: 15000, headers: getZeroExHeaders() });
  if (data?.transaction) return { txBase64: data.transaction };
  if (!data) throw new Error('0x: no instructions');
  return { instructions: data.instructions, addressLookupTableAddresses: data.addressLookupTableAddresses };
}
async function assembleV0FromInstructions({ connection, owner, payload }) {
  // payload: { instructions: base64[], addressLookupTableAddresses?: string[] }
  const cuIxs = (payload.computeBudgetInstructions || []).map((b64) => Transaction.from(Buffer.from(b64, 'base64')).instructions).flat();
  const setupIxs = (payload.setupInstructions || []).map((b64) => Transaction.from(Buffer.from(b64, 'base64')).instructions).flat();
  const swapIx = payload.swapInstruction ? Transaction.from(Buffer.from(payload.swapInstruction, 'base64')).instructions[0] : null;
  const cleanupIxs = (payload.cleanupInstruction ? [payload.cleanupInstruction] : []).map((b64) => Transaction.from(Buffer.from(b64, 'base64')).instructions).flat();
  const instructions = [...cuIxs, ...setupIxs, ...(swapIx ? [swapIx] : []), ...cleanupIxs];
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tables = [];
  const alts = payload.addressLookupTableAddresses || [];
  for (const addr of alts) {
    const { value } = await connection.getAddressLookupTable(new PublicKey(addr));
    if (value) tables.push(value);
  }
  const message = new TransactionMessage({ payerKey: owner.publicKey, recentBlockhash: blockhash, instructions }).compileToV0Message(tables);
  const vtx = new VersionedTransaction(message);
  vtx.sign([owner]);
  return vtx;
}

import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

import raydiumSdk from '@raydium-io/raydium-sdk-v2';
const {
  Raydium,
  ALL_PROGRAM_ID,
  liquidityStateV4Layout,
  MARKET_STATE_LAYOUT_V3,
  getSerumAssociatedAuthority,
  makeAMMSwapInstruction,
  createWSolAccountInstructions,
} = raydiumSdk;

const WSOL = 'So11111111111111111111111111111111111111112';

async function getRaydiumQuote({ inputMint, outputMint, amount, slippageBps, txVersion }) {
  const url = 'https://transaction-v1.raydium.io/compute/swap-base-in';
  const { data } = await axios.get(url, {
    params: {
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps: String(slippageBps),
      txVersion,
    },
    timeout: 10000,
    headers: { 'user-agent': 'jupbot/1.0 (+sdkSwap)' },
  });
  if (!data || !data.data) throw new Error('no compute quote');
  return data.data;
}

async function getJupiterQuote({ inputMint, outputMint, amount, slippageBps }) {
  const params = {
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps ?? 100),
    // V6 API uses 'true' for boolean
    onlyDirectRoutes: 'false',
    asLegacyTransaction: 'false',
  };
  const headers = { 
    'user-agent': 'jupbot/1.0 (+sdkSwap)',
    'Accept': 'application/json'
  };
  if (process.env.JUPITER_API_KEY) {
    headers['x-api-key'] = process.env.JUPITER_API_KEY;
  }
  
  // Use Jupiter v6 endpoint
  const url = 'https://api.jup.ag/v6/quote';
  
  try {
    const { data } = await axios.get(url, { params, timeout: 15000, headers });
    if (!data) throw new Error('jupiter: no quote');
    if (data.error || data.message) throw new Error(`jupiter: ${data.error || data.message}`);
    return data; // quoteResponse
  } catch (e) {
    const msg = e?.response?.data || e?.message || String(e);
    throw new Error(`Jupiter quote failed: ${JSON.stringify(msg).slice(0, 200)}`);
  }
}

async function buildJupiterSwapTx({ quoteResponse, userPublicKey, computeUnitPriceMicroLamports = 0 }) {
  const headers = { 
    'user-agent': 'jupbot/1.0 (+sdkSwap)'
  };
  if (process.env.JUPITER_API_KEY) {
    headers['x-api-key'] = process.env.JUPITER_API_KEY;
  }
  const urls = [ 'https://api.jup.ag/v6/swap' ];
  let lastErr;
  for (const url of urls) {
    try {
      const { data } = await axios.post(url, {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        computeUnitPriceMicroLamports,
        prioritizationFeeLamports: undefined,
      }, { timeout: 15000, headers });
      if (!data || !data.swapTransaction) throw new Error('jupiter: no swapTransaction');
      return data.swapTransaction; // base64
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('jupiter: swap build failed');
}

async function buildJupiterSwapInstructionsTx({ connection, quoteResponse, userPublicKey, owner }) {
  const headers = { 
    'user-agent': 'jupbot/1.0 (+sdkSwap)'
  };
  if (process.env.JUPITER_API_KEY) {
    headers['x-api-key'] = process.env.JUPITER_API_KEY;
  }
  const url = 'https://quote-api.jup.ag/v6/swap-instructions';
  const { data } = await axios.post(url, {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
  }, { timeout: 15000, headers });
  if (!data) throw new Error('jupiter: no swap-instructions');
  const ix = data;
  const cuIxs = (ix.computeBudgetInstructions || []).map((b64) => Transaction.from(Buffer.from(b64, 'base64')).instructions).flat();
  const setupIxs = (ix.setupInstructions || []).map((b64) => Transaction.from(Buffer.from(b64, 'base64')).instructions).flat();
  const swapIx = Transaction.from(Buffer.from(ix.swapInstruction, 'base64')).instructions[0];
  const cleanupIxs = (ix.cleanupInstruction ? [ix.cleanupInstruction] : []).map((b64) => Transaction.from(Buffer.from(b64, 'base64')).instructions).flat();

  const lookupAddresses = ix.addressLookupTableAddresses || [];
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tables = [];
  for (const addr of lookupAddresses) {
    const { value } = await connection.getAddressLookupTable(new PublicKey(addr));
    if (value) tables.push(value);
  }

  const message = new TransactionMessage({
    payerKey: owner.publicKey,
    recentBlockhash: blockhash,
    instructions: [...cuIxs, ...setupIxs, swapIx, ...cleanupIxs],
  }).compileToV0Message(tables);

  const vtx = new VersionedTransaction(message);
  vtx.sign([owner]);
  return vtx;
}

async function ensureAtaIx(connection, owner, mint, payer) {
  const ata = getAssociatedTokenAddressSync(mint, owner, false);
  const info = await connection.getAccountInfo(ata, 'confirmed');
  if (info) return { ata, createIx: null };
  return {
    ata,
    createIx: createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
  };
}

async function fetchAmmV4PoolKeys(connection, poolId) {
  const poolPk = new PublicKey(poolId);
  const acc = await connection.getAccountInfo(poolPk, 'confirmed');
  if (!acc) throw new Error(`pool account not found: ${poolId}`);

  if (!acc.owner.equals(ALL_PROGRAM_ID.AMM_V4)) {
    return { isAmmV4: false };
  }

  const state = liquidityStateV4Layout.decode(acc.data);
  const marketId = state.marketId;
  const marketProgramId = state.marketProgramId;

  const marketAcc = await connection.getAccountInfo(marketId, 'confirmed');
  if (!marketAcc) throw new Error(`market account not found: ${marketId.toBase58()}`);

  const marketState = MARKET_STATE_LAYOUT_V3.decode(marketAcc.data);
  const { publicKey: marketAuthority } = getSerumAssociatedAuthority({ programId: marketProgramId, marketId });

  const poolKeys = {
    id: poolPk.toBase58(),
    programId: ALL_PROGRAM_ID.AMM_V4.toBase58(),

    authority: state.owner.toBase58(),
    openOrders: state.openOrders.toBase58(),
    targetOrders: state.targetOrders.toBase58(),

    vault: {
      A: state.baseVault.toBase58(),
      B: state.quoteVault.toBase58(),
    },

    mintA: { address: state.baseMint.toBase58() },
    mintB: { address: state.quoteMint.toBase58() },
    mintLp: { address: state.lpMint.toBase58() },

    marketProgramId: marketProgramId.toBase58(),
    marketId: marketId.toBase58(),
    marketAuthority: marketAuthority.toBase58(),

    marketBaseVault: marketState.baseVault.toBase58(),
    marketQuoteVault: marketState.quoteVault.toBase58(),
    marketBids: marketState.bids.toBase58(),
    marketAsks: marketState.asks.toBase58(),
    marketEventQueue: marketState.eventQueue.toBase58(),
  };

  return {
    isAmmV4: true,
    poolKeys,
    mintA: new PublicKey(poolKeys.mintA.address),
    mintB: new PublicKey(poolKeys.mintB.address),
  };
}

export async function runSdkSwap({
  rpcUrl,
  walletPath,
  inputMint,
  outputMint,
  amountLamports,
  slippageBps = 100,
  txVersion = 'V0',
  maxAttempts = 10,
}) {
  const forceJup = process.env.FORCE_JUPITER === '1';
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const owner = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');

  const ray = await Raydium.load({ connection, owner, disableLoadToken: false });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Primary: 0x (if api key present)
    if (process.env.ZEROX_API_KEY) {
      try {
        const q = await retryRpc(() => zeroExQuote({ inputMint, outputMint, amount: amountLamports, slippageBps, taker: owner.publicKey.toBase58() }), { tries: 4, baseMs: 400 });
        try {
          const built = await retryRpc(() => zeroExBuild({ quote: q, taker: owner.publicKey.toBase58() }), { tries: 3, baseMs: 600 });
          if (built.txBase64) {
            const buf = Buffer.from(built.txBase64, 'base64');
            try {
              let vtx = VersionedTransaction.deserialize(buf);
              vtx.sign([owner]);
              const sp = process.env.SKIP_PREFLIGHT === '0' ? false : true;
              const sig = await retryRpc(() => connection.sendRawTransaction(vtx.serialize(), { skipPreflight: sp }));
              await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
              return [sig];
            } catch {
              const ltx = Transaction.from(buf);
              const sp = process.env.SKIP_PREFLIGHT === '0' ? false : true;
              const sig = await retryRpc(() => connection.sendTransaction(ltx, [owner], { skipPreflight: sp }));
              await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
              return [sig];
            }
          } else if (built.instructions) {
            const vtx = await assembleV0FromInstructions({ connection, owner, payload: built });
            const sp = process.env.SKIP_PREFLIGHT === '0' ? false : true;
            const sig = await retryRpc(() => connection.sendRawTransaction(vtx.serialize(), { skipPreflight: sp }));
            await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
            return [sig];
          }
        } catch (e) {
          // 0x build failed → fall through to Jupiter
        }
      } catch (e) {
        // 0x quote failed → fall through to Jupiter
      }
    }

    // FORCE Jupiter path when requested
    if (forceJup) {
      const jQ = await getJupiterQuote({ inputMint, outputMint, amount: amountLamports, slippageBps });
      try {
        const swapB64 = await buildJupiterSwapTx({ quoteResponse: jQ, userPublicKey: owner.publicKey.toBase58(), computeUnitPriceMicroLamports: 0 });
        const buf = Buffer.from(swapB64, 'base64');
        try {
          let vtx = VersionedTransaction.deserialize(buf);
          vtx.sign([owner]);
          const sp = process.env.SKIP_PREFLIGHT === '0' ? false : true;
          const sig = await retryRpc(() => connection.sendRawTransaction(vtx.serialize(), { skipPreflight: sp }));
          await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
          return [sig];
        } catch {
          const ltx = Transaction.from(buf);
          const sp = process.env.SKIP_PREFLIGHT === '0' ? false : true;
          const sig = await retryRpc(() => connection.sendTransaction(ltx, [owner], { skipPreflight: sp }));
          await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
          return [sig];
        }
      } catch (e) {
        // Fallback to swap-instructions assembly
        const vtx = await buildJupiterSwapInstructionsTx({ connection, quoteResponse: jQ, userPublicKey: owner.publicKey.toBase58(), owner });
        const sp = process.env.SKIP_PREFLIGHT === '0' ? false : true;
        const sig = await retryRpc(() => connection.sendRawTransaction(vtx.serialize(), { skipPreflight: sp }));
        await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
        return [sig];
      }
    }

    let quote;
    try {
      quote = await getRaydiumQuote({
        inputMint,
        outputMint,
        amount: amountLamports,
        slippageBps,
        txVersion: txVersion === 'LEGACY' ? 'LEGACY' : 'V0',
      });
    } catch (e) {
      // Fallback to Jupiter path
      const jQ = await getJupiterQuote({ inputMint, outputMint, amount: amountLamports, slippageBps });
      const swapB64 = await buildJupiterSwapTx({ quoteResponse: jQ, userPublicKey: owner.publicKey.toBase58(), computeUnitPriceMicroLamports: 0 });
      const buf = Buffer.from(swapB64, 'base64');
      let tx;
      try {
        tx = VersionedTransaction.deserialize(buf);
        tx.sign([owner]);
        const sig = await retryRpc(() => connection.sendRawTransaction(tx.serialize(), { skipPreflight: false }));
        await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
        return [sig];
      } catch {
        const ltx = Transaction.from(buf);
        const sig = await retryRpc(() => connection.sendTransaction(ltx, [owner], { skipPreflight: false }));
        await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
        return [sig];
      }
    }

    const route = quote.routePlan || [];

    // Some routes are 2-hop. We support up to 2 hops by executing sequential swaps.
    if (route.length === 2) {
      const hop1OutMint = route[0].outputMint;
      const hop2OutMint = outputMint;

      const sumTokenRaw = async (mintStr) => {
        const mintPk = new PublicKey(mintStr);
        const resp = await connection.getTokenAccountsByOwner(owner.publicKey, { mint: mintPk }, 'confirmed');
        let total = 0n;
        for (const { pubkey } of resp.value) {
          const bal = await connection.getTokenAccountBalance(pubkey, 'confirmed');
          total += BigInt(bal.value.amount);
        }
        return total;
      };

      // 1) Execute hop1: inputMint -> hop1OutMint with fixed amountIn.
      const before = await sumTokenRaw(hop1OutMint);
      await runSdkSwap({
        rpcUrl,
        walletPath,
        inputMint,
        outputMint: hop1OutMint,
        amountLamports,
        slippageBps,
        txVersion,
        maxAttempts,
      });
      const after = await sumTokenRaw(hop1OutMint);
      const delta = after - before;
      if (delta <= 0n) throw new Error(`multi-hop hop1 produced no ${hop1OutMint} (delta=${delta})`);

      // 2) Execute hop2: hop1OutMint -> hop2OutMint with amountIn = actual received.
      return await runSdkSwap({
        rpcUrl,
        walletPath,
        inputMint: hop1OutMint,
        outputMint: hop2OutMint,
        amountLamports: Number(delta),
        slippageBps,
        txVersion,
        maxAttempts,
      });
    }

    if (route.length !== 1) {
      if (attempt === maxAttempts) {
        throw new Error(`unsupported route length in sdkSwap.mjs (got ${route.length})`);
      }
      continue;
    }

    const hop = route[0];
    const poolId = hop.poolId;

    const poolOwnerInfo = await connection.getAccountInfo(new PublicKey(poolId), 'confirmed');
    if (!poolOwnerInfo) throw new Error(`pool not found for id ${poolId}`);

    if (poolOwnerInfo.owner.equals(ALL_PROGRAM_ID.AMM_V4)) {
      // Fallback to Jupiter for AMM v4 pools to avoid SDK mismatches (Serum authority helpers etc.)
      const jQ = await getJupiterQuote({ inputMint, outputMint, amount: amountLamports, slippageBps });
      const swapB64 = await buildJupiterSwapTx({ quoteResponse: jQ, userPublicKey: owner.publicKey.toBase58(), computeUnitPriceMicroLamports: 0 });
      const buf = Buffer.from(swapB64, 'base64');
      try {
        let vtx = VersionedTransaction.deserialize(buf);
        vtx.sign([owner]);
        const sig = await retryRpc(() => connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false }));
        await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
        return [sig];
      } catch {
        const ltx = Transaction.from(buf);
        const sig = await retryRpc(() => connection.sendTransaction(ltx, [owner], { skipPreflight: false }));
        await retryRpc(() => connection.confirmTransaction(sig, 'confirmed'));
        return [sig];
      }
    }

    // CLMM / CPMM using SDK builders
    const useSOLBalanceIn = inputMint === WSOL;
    let poolInfo, poolKeys, isClmm = false;

    try {
      const r = await ray.clmm.getPoolInfoFromRpc(poolId);
      poolInfo = r.poolInfo;
      poolKeys = r.poolKeys;
      isClmm = true;
    } catch {
      // ignore
    }

    if (!poolInfo) {
      const r = await ray.cpmm.getRpcPoolInfo({ poolId });
      poolInfo = r;
      poolKeys = await ray.cpmm.getCpmmPoolKeys(poolId);
    }

    const slippage = slippageBps / 10000;
    const txv = txVersion === 'LEGACY' ? 1 : 0;

    if (isClmm) {
      // NOTE: CLMM swap() signature differs from CPMM. It requires inputMint/amountIn/amountOutMin.
      // Our route is discovered via the Trade API compute endpoint (swap-base-in), so we treat
      // `amountLamports` as amountIn and `quote.otherAmountThreshold` as amountOutMin.
      const amountIn = new BN(String(amountLamports));
      const amountOutMin = new BN(String(quote.otherAmountThreshold || '0'));
      if (amountOutMin.lten(0)) throw new Error('quote.otherAmountThreshold missing/invalid');

      const remainingAccounts = (hop.remainingAccounts || [])
        .map((a) => (typeof a === 'string' ? a : a?.toBase58?.() || a?.pubkey?.toBase58?.() || a?.pubkey))
        .filter(Boolean)
        .map((s) => new PublicKey(String(s)));

      const { execute } = await ray.clmm.swap({
        poolInfo,
        poolKeys,
        inputMint: new PublicKey(inputMint),
        amountIn,
        amountOutMin,
        // optional controls (leave undefined unless we start sourcing them from compute response)
        priceLimit: undefined,
        observationId: poolInfo?.observationId ?? new PublicKey(poolKeys?.observationId),
        remainingAccounts,

        config: { bypassAssociatedCheck: false, checkCreateATAOwner: false, associatedOnly: true },
        computeBudgetConfig: await ray.utils1216.getComputeBudgetConfig?.(),
        txTipConfig: undefined,
        txVersion: txv,
        feePayer: owner.publicKey,
        ownerInfo: { useSOLBalance: useSOLBalanceIn, feePayer: owner.publicKey },
      });
      const { txId } = await execute({ skipPreflight: false, sendAndConfirm: true });
      return [txId];
    }

    const { execute } = await ray.cpmm.swap({
      poolInfo,
      poolKeys,
      baseIn: true,
      inputAmount: new BN(String(amountLamports)),
      slippage,
      ownerInfo: { useSOLBalance: useSOLBalanceIn, feePayer: owner.publicKey },
      computeBudgetConfig: await ray.utils1216.getComputeBudgetConfig?.(),
      txTipConfig: undefined,
      txVersion: txv,
      feePayer: owner.publicKey,
    });

    const { txId } = await execute({ skipPreflight: false, sendAndConfirm: true });
    return [txId];
  }

  throw new Error(`failed to execute swap after ${maxAttempts} attempts`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rpcUrl = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const walletPath = process.env.SWAP_WALLET;
  const inputMint = process.env.INPUT_MINT || WSOL;
  const outputMint = process.env.OUTPUT_MINT;
  
  // Handle large amounts (USDC has 6 decimals, can be billions of raw units)
  // Use BigInt for parsing, then convert to Number only if safe
  const amountStr = process.env.AMOUNT_LAMPORTS || '5000000';
  let amount;
  try {
    const amountBig = BigInt(amountStr);
    // Check if it's safe to convert to Number (< Number.MAX_SAFE_INTEGER)
    if (amountBig <= BigInt(Number.MAX_SAFE_INTEGER)) {
      amount = Number(amountBig);
    } else {
      throw new Error(`Amount too large for safe conversion: ${amountStr}`);
    }
  } catch (e) {
    if (e.message.includes('too large')) throw e;
    // If BigInt parsing fails, try Number directly (backward compat)
    amount = Number(amountStr);
  }
  
  const slippageBps = Number(process.env.SLIPPAGE_BPS || 100);
  const txVersion = process.env.TX_VERSION || 'V0';

  if (!walletPath || !outputMint) throw new Error('Set SWAP_WALLET and OUTPUT_MINT');

  const sigs = await runSdkSwap({
    rpcUrl,
    walletPath,
    inputMint,
    outputMint,
    amountLamports: amount,
    slippageBps,
    txVersion,
  });

  console.log('TX IDs:', sigs);
}
