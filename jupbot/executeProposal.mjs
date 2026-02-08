import fs from 'node:fs';
import path from 'node:path';

// Uses the already-working Raydium SDK swap runner for execution.
// We execute SOL -> token for entry. Exits are handled by proposing an exit trade (confirmation required) in a later step.

const PROPOSALS_JSON = path.resolve('./trade_proposals.json');
const DESKTOP_CSV = '/home/j/Desktop/sol_trades.csv';

function nowIso() {
  return new Date().toISOString();
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[\n\r,\"]/g.test(s)) return '"' + s.replaceAll('"', '""') + '"';
  return s;
}

function appendCsv(row) {
  if (!fs.existsSync(DESKTOP_CSV)) {
    const header = [
      'timestamp','event','proposalId','mint','pair','direction','amountIn','amountInUnit','expectedOut','slippageBps','stopLossPct','takeProfitPct','dexUrl','raydiumRoutePoolId','txSig','status','notes'
    ].join(',') + '\n';
    fs.writeFileSync(DESKTOP_CSV, header);
  }
  fs.appendFileSync(DESKTOP_CSV, row.map(csvEscape).join(',') + '\n');
}

function loadProposals() {
  if (!fs.existsSync(PROPOSALS_JSON)) throw new Error('No trade_proposals.json found. Run tradeBot.mjs first.');
  return JSON.parse(fs.readFileSync(PROPOSALS_JSON, 'utf8'));
}

function saveProposals(doc) {
  fs.writeFileSync(PROPOSALS_JSON, JSON.stringify(doc, null, 2) + '\n');
}

async function execCmd(cmd, args, env = {}) {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let out = '';
    let err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('close', (code) => {
      if (code === 0) return resolve({ out, err });
      reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\nSTDOUT:\n${out}\nSTDERR:\n${err}`));
    });
  });
}

async function main() {
  const proposalId = process.argv[2];
  if (!proposalId) {
    console.error('Usage: node executeProposal.mjs <proposalId>');
    process.exit(1);
  }

  if (process.env.MAIN_WALLET !== '1') {
    throw new Error('MAIN_WALLET not confirmed. Set MAIN_WALLET=1 to proceed with a funded wallet.');
  }

  const doc = loadProposals();
  const p = (doc.proposals || []).find(x => x.id === proposalId);
  if (!p) {
    // Proposal lists are refreshed frequently; allow executing a "stale" proposal id by reconstructing
    // from the last-known snapshot if present in CSV.
    throw new Error(`Proposal not found: ${proposalId}. (It may have rotated out; reply YES to a currently listed proposal id.)`);
  }

  // Mark as executing
  p.status = 'EXECUTING';
  p.executingAt = nowIso();
  saveProposals(doc);

  appendCsv([
    nowIso(),'EXECUTE_REQUEST',p.id,p.mint,p.pair,'SOL->TOKEN',p.amountInSol,'SOL',p.expectedOut || '',p.slippageBps,p.stopLossPct,p.takeProfitPct,p.dexUrl,p.raydiumPoolId || '','', 'EXECUTING','user-approved'
  ]);

  // Execute via sdkSwap.mjs in SOL->token mode.
  // sdkSwap.mjs currently supports SOL->mint by env:
  //   MODE=buy, OUT_MINT=<mint>, AMOUNT_SOL=<amount>
  // We keep txVersion LEGACY for reliability.

  const env = {
    // sdkSwap.mjs expects:
    //   SWAP_WALLET=<path>
    //   OUTPUT_MINT=<mint>
    //   AMOUNT_LAMPORTS=<number>
    //   (optional) INPUT_MINT defaults to WSOL
    SWAP_WALLET: process.env.SWAP_WALLET || './wallets/generated_keypair.json',
    OUTPUT_MINT: p.mint,
    AMOUNT_LAMPORTS: String(p.amountInLamports),
    SLIPPAGE_BPS: String(p.slippageBps),
    TX_VERSION: 'LEGACY',
    MAIN_WALLET: '1'
  };

  const { out } = await execCmd('node', ['./sdkSwap.mjs'], env);

  // Try to extract a signature from output.
  const sigMatch = out.match(/\b[1-9A-HJ-NP-Za-km-z]{80,120}\b/);
  const sig = sigMatch ? sigMatch[0] : '';

  p.status = sig ? 'EXECUTED' : 'EXECUTED_UNKNOWN_SIG';
  p.executedAt = nowIso();
  p.txSig = sig;
  saveProposals(doc);

  // Track position for exit monitoring (sum all token accounts by mint later; for now we store expected out as a baseline).
  try {
    const { Connection, Keypair, PublicKey } = await import('@solana/web3.js');
    const fs = await import('node:fs');

    const rpcUrl = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    const conn = new Connection(rpcUrl, 'confirmed');
    const secret = JSON.parse(fs.readFileSync(env.SWAP_WALLET, 'utf8'));
    const owner = Keypair.fromSecretKey(new Uint8Array(secret));
    const mint = new PublicKey(p.mint);

    const resp = await conn.getTokenAccountsByOwner(owner.publicKey, { mint }, 'confirmed');
    let total = 0n;
    let decimals = null;
    for (const { pubkey } of resp.value) {
      const bal = await conn.getTokenAccountBalance(pubkey, 'confirmed');
      total += BigInt(bal.value.amount);
      decimals ??= bal.value.decimals;
    }

    const posPath = './positions.json';
    let posDoc = { updatedAt: null, positions: [] };
    if (fs.existsSync(posPath)) posDoc = JSON.parse(fs.readFileSync(posPath, 'utf8'));
    posDoc.positions = (posDoc.positions || []).filter(pp => pp.mint !== p.mint);
    posDoc.positions.unshift({
      mint: p.mint,
      pair: p.pair,
      dexUrl: p.dexUrl,
      entrySol: p.amountInSol,
      amountInTokenRaw: total.toString(),
      tokenDecimals: decimals,
      slippageBps: p.slippageBps,
      stopLossPct: p.stopLossPct,
      takeProfitPct: p.takeProfitPct,
      entryTxSig: sig,
      openedAt: nowIso(),
    });
    posDoc.updatedAt = nowIso();
    // bound
    posDoc.positions = posDoc.positions.slice(0, 20);
    fs.writeFileSync(posPath, JSON.stringify(posDoc, null, 2) + '\n');
  } catch {}

  appendCsv([
    nowIso(),'EXECUTED',p.id,p.mint,p.pair,'SOL->TOKEN',p.amountInSol,'SOL',p.expectedOut || '',p.slippageBps,p.stopLossPct,p.takeProfitPct,p.dexUrl,p.raydiumPoolId || '',sig,p.status,'see stdout for details'
  ]);

  console.log(JSON.stringify({ ok: true, proposalId: p.id, txSig: sig, status: p.status }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
