import fs from 'node:fs';
import path from 'node:path';

const PROPOSALS_JSON = path.resolve('./trade_proposals.json');
const POSITIONS_JSON = path.resolve('./positions.json');

const LOOP_INTERVAL_SEC = Number(process.env.CADENCE_SEC || '30');
const MAX_OPEN_POSITIONS = Number(process.env.MAX_OPEN_POSITIONS || '2');
const SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS || '150');

const AMOUNT_IN_SOL = Number(process.env.AMOUNT_IN_SOL || '0.005');
const STOPLOSS_PCT = Number(process.env.STOPLOSS_PCT || '10');
const TAKEPROFIT_PCT = Number(process.env.TAKEPROFIT_PCT || '12');

const WSOL = 'So11111111111111111111111111111111111111112';
const RAYDIUM_COMPUTE_BASE_IN = 'https://transaction-v1.raydium.io/compute/swap-base-in';

function nowIso() {
  return new Date().toISOString();
}

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, doc) {
  fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
}

function genId() {
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

async function computeOutAmount({ inputMint, outputMint, amountInLamports, slippageBps }) {
  const url = new URL(RAYDIUM_COMPUTE_BASE_IN);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', String(amountInLamports));
  url.searchParams.set('slippageBps', String(slippageBps));
  url.searchParams.set('txVersion', 'LEGACY');

  const json = await fetchJson(url.toString());
  if (!json?.success) throw new Error(json?.msg || json?.error || 'Raydium compute failed');

  const route0 = json?.data?.routePlan?.[0];
  return {
    outputAmount: BigInt(json?.data?.outputAmount || 0),
    priceImpactPct: json?.data?.priceImpactPct,
    poolId: route0?.poolId || null,
  };
}

async function autoSell({ pos, amountInTokenRaw, slippageBps }) {
  if (process.env.AUTO_SELL !== '1') return null;
  if (process.env.MAIN_WALLET !== '1') return null;

  const env = {
    ...process.env,
    SWAP_WALLET: process.env.SWAP_WALLET || './wallets/generated_keypair.json',
    INPUT_MINT: pos.mint,
    OUTPUT_MINT: WSOL,
    AMOUNT_LAMPORTS: String(amountInTokenRaw),
    SLIPPAGE_BPS: String(slippageBps ?? SLIPPAGE_BPS),
    TX_VERSION: 'LEGACY',
    MAIN_WALLET: '1',
  };

  const { spawn } = await import('node:child_process');
  const out = await new Promise((resolve, reject) => {
    const p = spawn('node', ['./sdkSwap.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', d => stdout += d.toString());
    p.stderr.on('data', d => stderr += d.toString());
    p.on('close', (code) => {
      if (code === 0) return resolve(stdout + '\n' + stderr);
      reject(new Error(`autoSell failed (${code}): ${stderr || stdout}`));
    });
  });

  const sigMatch = out.match(/\b[1-9A-HJ-NP-Za-km-z]{80,120}\b/);
  return sigMatch ? sigMatch[0] : null;
}

function recordSellIntent({ proposalsDoc, pos, expectedSolOut, poolId, reason }) {
  // Avoid duplicates: if there is already a pending sell record for this mint, do nothing.
  const existing = (proposalsDoc.proposals || []).find(p => p.direction === 'TOKEN->SOL' && p.mint === pos.mint && (p.status === 'READY_TO_SELL' || p.status === 'SOLD' || p.status === 'SOLD_UNKNOWN_SIG'));
  if (existing) return null;

  const proposalId = genId();
  const sell = {
    id: proposalId,
    createdAt: nowIso(),
    mint: pos.mint,
    pair: pos.pair || '',
    dexUrl: pos.dexUrl || '',
    direction: 'TOKEN->SOL',
    amountInTokenRaw: pos.amountInTokenRaw,
    slippageBps: pos.slippageBps ?? SLIPPAGE_BPS,
    stopLossPct: pos.stopLossPct ?? STOPLOSS_PCT,
    takeProfitPct: pos.takeProfitPct ?? TAKEPROFIT_PCT,
    raydiumPoolId: poolId || null,
    expectedOutSol: expectedSolOut,
    reason,
    status: 'READY_TO_SELL'
  };

  proposalsDoc.proposals = proposalsDoc.proposals || [];
  proposalsDoc.proposals.unshift(sell);
  proposalsDoc.updatedAt = nowIso();
  proposalsDoc.proposals = proposalsDoc.proposals.slice(0, 120);
  saveJson(PROPOSALS_JSON, proposalsDoc);
  return sell;
}

async function checkExits() {
  const posDoc = loadJson(POSITIONS_JSON, { updatedAt: null, positions: [] });
  const proposalsDoc = loadJson(PROPOSALS_JSON, { updatedAt: null, proposals: [] });

  for (const pos of (posDoc.positions || [])) {
    if (!pos?.mint || !pos?.amountInTokenRaw) continue;

    // Quote full exit
    let q;
    try {
      q = await computeOutAmount({
        inputMint: pos.mint,
        outputMint: WSOL,
        amountInLamports: pos.amountInTokenRaw,
        slippageBps: pos.slippageBps ?? SLIPPAGE_BPS,
      });
    } catch {
      continue;
    }

    const expectedSolOut = Number(q.outputAmount) / 1e9;
    const entrySol = Number(pos.entrySol || 0);
    if (!entrySol) continue;

    const tp = entrySol * (1 + (pos.takeProfitPct ?? TAKEPROFIT_PCT) / 100);
    const sl = entrySol * (1 - (pos.stopLossPct ?? STOPLOSS_PCT) / 100);

    if (expectedSolOut >= tp || expectedSolOut <= sl) {
      const reason = expectedSolOut >= tp ? 'TAKE_PROFIT' : 'STOP_LOSS';
      // Record the sell signal for auditability.
      recordSellIntent({ proposalsDoc, pos, expectedSolOut, poolId: q.poolId, reason });

      // Auto-sell (no user confirmation) if enabled.
      try {
        const sig = await autoSell({ pos, amountInTokenRaw: pos.amountInTokenRaw, slippageBps: pos.slippageBps });
        if (sig) {
          // Mark proposal sold
          const rec = (proposalsDoc.proposals || []).find(p => p.direction === 'TOKEN->SOL' && p.mint === pos.mint && p.status === 'READY_TO_SELL');
          if (rec) {
            rec.status = 'SOLD';
            rec.executedAt = nowIso();
            rec.txSig = sig;
            proposalsDoc.updatedAt = nowIso();
            saveJson(PROPOSALS_JSON, proposalsDoc);
          }
          // Remove position
          posDoc.positions = (posDoc.positions || []).filter(pp => pp.mint !== pos.mint);
          posDoc.updatedAt = nowIso();
          saveJson(POSITIONS_JSON, posDoc);
        }
      } catch {
        // If auto-sell fails, we leave the READY_TO_SELL record for manual intervention.
      }
    }
  }
}

async function scanEntries() {
  // If we already have max open positions, don't generate more entries.
  const posDoc = loadJson(POSITIONS_JSON, { updatedAt: null, positions: [] });
  const openCount = (posDoc.positions || []).length;
  if (openCount >= MAX_OPEN_POSITIONS) return;

  // Run tradeBot once to generate new entry proposals.
  // tradeBot already handles DexScreener mapping + Raydium compute.
  const { spawn } = await import('node:child_process');
  await new Promise((resolve) => {
    const p = spawn('node', ['./tradeBot.mjs'], {
      stdio: 'ignore',
      env: {
        ...process.env,
        AMOUNT_IN_SOL: String(AMOUNT_IN_SOL),
        SLIPPAGE_BPS: String(SLIPPAGE_BPS),
        STOPLOSS_PCT: String(STOPLOSS_PCT),
        TAKEPROFIT_PCT: String(TAKEPROFIT_PCT),
      }
    });
    p.on('close', () => resolve());
  });
}

async function main() {
  console.log(`[tradeLoop] starting ${nowIso()} cadence=${LOOP_INTERVAL_SEC}s maxOpen=${MAX_OPEN_POSITIONS} size=${AMOUNT_IN_SOL} slippageBps=${SLIPPAGE_BPS} TP=${TAKEPROFIT_PCT}% SL=${STOPLOSS_PCT}%`);

  for (;;) {
    try {
      await checkExits();
      await scanEntries();
    } catch (e) {
      // swallow and continue
    }
    await new Promise(r => setTimeout(r, LOOP_INTERVAL_SEC * 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
