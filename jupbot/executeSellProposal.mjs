import fs from 'node:fs';
import path from 'node:path';

const PROPOSALS_JSON = path.resolve('./trade_proposals.json');
const POSITIONS_JSON = path.resolve('./positions.json');
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

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, doc) {
  fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
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

function extractSig(stdout) {
  // sdkSwap.mjs prints: TX IDs: [ '...' ]
  const m = stdout.match(/\b[1-9A-HJ-NP-Za-km-z]{80,120}\b/);
  return m ? m[0] : '';
}

async function main() {
  const proposalId = process.argv[2];
  if (!proposalId) {
    console.error('Usage: node executeSellProposal.mjs <proposalId>');
    process.exit(1);
  }
  if (process.env.MAIN_WALLET !== '1') {
    throw new Error('MAIN_WALLET not confirmed. Set MAIN_WALLET=1 to proceed with a funded wallet.');
  }

  const proposals = loadJson(PROPOSALS_JSON, { proposals: [] });
  const p = (proposals.proposals || []).find(x => x.id === proposalId);
  if (!p) throw new Error(`Sell proposal not found: ${proposalId}`);
  if (p.status !== 'READY_TO_SELL') throw new Error(`Sell proposal status is ${p.status}, expected READY_TO_SELL`);

  const mint = p.mint;
  const amountRaw = p.amountInTokenRaw;
  const slippageBps = p.slippageBps ?? 150;

  p.status = 'EXECUTING_SELL';
  p.executingAt = nowIso();
  saveJson(PROPOSALS_JSON, proposals);

  appendCsv([
    nowIso(),'SELL_EXECUTE_REQUEST',proposalId,mint,p.pair || '', 'TOKEN->SOL', amountRaw,'TOKEN','',slippageBps,p.stopLossPct ?? '',p.takeProfitPct ?? '',p.dexUrl || '',p.raydiumPoolId || '', '', 'EXECUTING','user-confirmed sell'
  ]);

  const env = {
    SWAP_WALLET: process.env.SWAP_WALLET || './wallets/generated_keypair.json',
    INPUT_MINT: mint,
    OUTPUT_MINT: 'So11111111111111111111111111111111111111112',
    AMOUNT_LAMPORTS: String(amountRaw),
    SLIPPAGE_BPS: String(slippageBps),
    TX_VERSION: 'LEGACY',
    MAIN_WALLET: '1'
  };

  const { out } = await execCmd('node', ['./sdkSwap.mjs'], env);
  const sig = extractSig(out);

  p.status = sig ? 'SOLD' : 'SOLD_UNKNOWN_SIG';
  p.executedAt = nowIso();
  p.txSig = sig;
  saveJson(PROPOSALS_JSON, proposals);

  // remove/close position if tracked
  const posDoc = loadJson(POSITIONS_JSON, { updatedAt: null, positions: [] });
  posDoc.positions = (posDoc.positions || []).filter(pp => pp.mint !== mint);
  posDoc.updatedAt = nowIso();
  saveJson(POSITIONS_JSON, posDoc);

  appendCsv([
    nowIso(),'SELL_EXECUTED',proposalId,mint,p.pair || '', 'TOKEN->SOL', amountRaw,'TOKEN','',slippageBps,p.stopLossPct ?? '',p.takeProfitPct ?? '',p.dexUrl || '',p.raydiumPoolId || '', sig, p.status,'see stdout for details'
  ]);

  console.log(JSON.stringify({ ok: true, proposalId, txSig: sig, status: p.status }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
