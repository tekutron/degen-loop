import fs from 'node:fs';
import path from 'node:path';

const DESKTOP_CSV = '/home/j/Desktop/sol_trades.csv';
const PROPOSALS_JSON = path.resolve('./trade_proposals.json');

// DexScreener public API (no key). Docs are informal; this endpoint is widely used.
const DEX_SEARCH_ENDPOINT = 'https://api.dexscreener.com/latest/dex/search?q=';
// Venue mapping (v1): use DexScreener search terms as a proxy for Pump.fun / Moonshot / BONK ecosystem.
// You can override with DEX_QUERIES env.
const DEX_QUERIES = (process.env.DEX_QUERIES || 'pump,pumpfun,moon,moonshot,bonk,solana').split(',').map(s => s.trim()).filter(Boolean);

const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const RAYDIUM_COMPUTE_BASE_IN = 'https://transaction-v1.raydium.io/compute/swap-base-in';

function nowIso() {
  return new Date().toISOString();
}

function ensureCsvHeader() {
  if (fs.existsSync(DESKTOP_CSV)) return;
  const header = [
    'timestamp',
    'event',
    'proposalId',
    'mint',
    'pair',
    'direction',
    'amountIn',
    'amountInUnit',
    'expectedOut',
    'slippageBps',
    'stopLossPct',
    'takeProfitPct',
    'dexUrl',
    'raydiumRoutePoolId',
    'txSig',
    'status',
    'notes'
  ].join(',') + '\n';
  fs.writeFileSync(DESKTOP_CSV, header);
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[\n\r,\"]/g.test(s)) return '"' + s.replaceAll('"', '""') + '"';
  return s;
}

function appendCsv(row) {
  ensureCsvHeader();
  fs.appendFileSync(DESKTOP_CSV, row.map(csvEscape).join(',') + '\n');
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function pickCandidates(dex, opts) {
  const { minLiquidityUsd, minVol1hUsd, minVol5mUsd, maxAgeMinutes, maxLiquidityUsd } = opts;
  const now = Date.now();

  const pairs = (dex?.pairs || []).filter(p => p?.chainId === 'solana');

  // Map/score. Note: DexScreener fields can vary; we guard.
  const scored = pairs.map(p => {
    const liquidityUsd = Number(p?.liquidity?.usd || 0);
    const vol1h = Number(p?.volume?.h1 || 0);
    const vol5m = Number(p?.volume?.m5 || 0);
    const priceChange5m = Number(p?.priceChange?.m5 || 0);
    const priceChange1h = Number(p?.priceChange?.h1 || 0);
    const createdAt = Number(p?.pairCreatedAt || 0);
    const ageMin = createdAt ? (now - createdAt) / 60000 : Infinity;

    // Favor fresh volume + short-term momentum, but keep some liquidity sanity.
    const score = (vol1h / 1000) + (vol5m / 200) + priceChange5m * 0.8 + priceChange1h * 0.2;

    return {
      p,
      liquidityUsd,
      vol1h,
      vol5m,
      priceChange5m,
      priceChange1h,
      ageMin,
      score,
    };
  })
  .filter(x => x.liquidityUsd >= minLiquidityUsd)
  .filter(x => (maxLiquidityUsd ? x.liquidityUsd <= maxLiquidityUsd : true))
  .filter(x => x.vol1h >= minVol1hUsd)
  .filter(x => x.vol5m >= (minVol5mUsd ?? 0))
  .filter(x => x.ageMin <= maxAgeMinutes)
  .sort((a, b) => b.score - a.score);

  return scored;
}

function isSolanaMintAddress(addr) {
  if (!addr || typeof addr !== 'string') return false;
  if (addr.startsWith('0x') || addr.startsWith('0X')) return false;
  // Rough base58 check + typical Solana mint length.
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function extractSolPairTokenMint(pair) {
  // Identify token mint that isn't SOL/WSOL. DexScreener supplies baseToken/quoteToken with address.
  const base = pair?.baseToken;
  const quote = pair?.quoteToken;

  const baseSym = (base?.symbol || '').toUpperCase();
  const quoteSym = (quote?.symbol || '').toUpperCase();

  const baseAddr = base?.address;
  const quoteAddr = quote?.address;

  // If either side looks like SOL/WSOL, pick the other.
  const isSolLike = (sym, addr) => sym === 'SOL' || addr === WSOL_MINT;

  if (isSolLike(baseSym, baseAddr) && isSolanaMintAddress(quoteAddr)) {
    if (quoteSym === 'SOL') return null;
    return { mint: quoteAddr, pairSide: 'SOL/QUOTE' };
  }
  if (isSolLike(quoteSym, quoteAddr) && isSolanaMintAddress(baseAddr)) {
    if (baseSym === 'SOL') return null;
    return { mint: baseAddr, pairSide: 'BASE/SOL' };
  }

  // Fallback: if neither side is SOL-like, skip.
  return null;
}

async function raydiumComputeBaseIn({ inputMint, outputMint, amountIn, slippageBps }) {
  const url = new URL(RAYDIUM_COMPUTE_BASE_IN);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', String(amountIn));
  url.searchParams.set('slippageBps', String(slippageBps));
  url.searchParams.set('txVersion', 'LEGACY');

  const json = await fetchJson(url.toString());
  if (!json?.success) throw new Error(`Raydium compute failed: ${JSON.stringify(json).slice(0, 300)}`);
  const route0 = json?.data?.routePlan?.[0];
  return {
    raw: json,
    poolId: route0?.poolId || null,
    expectedOut: json?.data?.outputAmount || null,
  };
}

function loadProposals() {
  if (!fs.existsSync(PROPOSALS_JSON)) return { updatedAt: null, proposals: [] };
  return JSON.parse(fs.readFileSync(PROPOSALS_JSON, 'utf8'));
}

function saveProposals(doc) {
  fs.writeFileSync(PROPOSALS_JSON, JSON.stringify(doc, null, 2) + '\n');
}

function genId() {
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}

async function main() {
  const amountInSol = Number(process.env.AMOUNT_IN_SOL || '0.005');
  const slippageBps = Number(process.env.SLIPPAGE_BPS || '150');
  const stopLossPct = Number(process.env.STOPLOSS_PCT || '10');
  const takeProfitPct = Number(process.env.TAKEPROFIT_PCT || '12');

  // “Degen mode” (DEGEN=1): bias toward newer / lower-liquidity pairs with meaningful short-term volume.
  const DEGEN = process.env.DEGEN === '1';

  const minLiquidityUsd = Number(process.env.MIN_LIQ_USD || (DEGEN ? '3000' : '15000'));
  const maxLiquidityUsd = Number(process.env.MAX_LIQ_USD || (DEGEN ? '250000' : '0')) || null;

  const minVol1hUsd = Number(process.env.MIN_VOL_1H_USD || (DEGEN ? '4000' : '8000'));
  const minVol5mUsd = Number(process.env.MIN_VOL_5M_USD || (DEGEN ? '1500' : '0'));

  const maxAgeMinutes = Number(process.env.MAX_AGE_MIN || (DEGEN ? '360' : '10000000')); // effectively no age filter by default

  // Convert SOL → lamports.
  const amountInLamports = BigInt(Math.floor(amountInSol * 1e9));

  const allPairs = [];
  for (const q of DEX_QUERIES) {
    try {
      const dex = await fetchJson(DEX_SEARCH_ENDPOINT + encodeURIComponent(q));
      for (const p of (dex?.pairs || [])) allPairs.push(p);
    } catch {}
  }
  // de-dupe by pairAddress
  const seen = new Set();
  const merged = [];
  for (const p of allPairs) {
    const key = `${p?.chainId}:${p?.pairAddress}`;
    if (!p?.pairAddress || seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }
  const dex = { pairs: merged };
  const candidates = pickCandidates(dex, {
    minLiquidityUsd,
    maxLiquidityUsd,
    minVol1hUsd,
    minVol5mUsd,
    maxAgeMinutes,
  }).slice(0, 20);

  const proposalsOut = [];

  for (const c of candidates) {
    const pair = c.p;
    const token = extractSolPairTokenMint(pair);
    if (!token) continue;

    const mint = token.mint;

    // Quick sanity: skip WSOL itself.
    if (mint === WSOL_MINT) continue;

    // Try to compute a route for SOL → mint via Raydium compute.
    try {
      const compute = await raydiumComputeBaseIn({
        inputMint: WSOL_MINT,
        outputMint: mint,
        amountIn: amountInLamports.toString(),
        slippageBps,
      });

      const proposalId = genId();
      const dexUrl = pair?.url || '';
      const pairName = `${pair?.baseToken?.symbol || '?'} / ${pair?.quoteToken?.symbol || '?'}`;

      const proposal = {
        id: proposalId,
        createdAt: nowIso(),
        mint,
        pair: pairName,
        dexUrl,
        score: c.score,
        liquidityUsd: c.liquidityUsd,
        vol1hUsd: c.vol1h,
        vol5mUsd: c.vol5m,
        priceChange5m: c.priceChange5m,
        priceChange1h: c.priceChange1h,
        amountInLamports: amountInLamports.toString(),
        amountInSol,
        slippageBps,
        stopLossPct,
        takeProfitPct,
        raydiumPoolId: compute.poolId,
        expectedOut: compute.expectedOut,
        txVersion: 'LEGACY',
        status: 'PROPOSED'
      };

      proposalsOut.push(proposal);

      appendCsv([
        nowIso(),
        'PROPOSAL',
        proposalId,
        mint,
        pairName,
        'SOL->TOKEN',
        amountInSol,
        'SOL',
        compute.expectedOut || '',
        slippageBps,
        stopLossPct,
        takeProfitPct,
        dexUrl,
        compute.poolId || '',
        '',
        'PROPOSED',
        `liqUsd=${c.liquidityUsd.toFixed?.(0) ?? c.liquidityUsd}; vol1hUsd=${c.vol1h.toFixed?.(0) ?? c.vol1h}; pc5m=${c.priceChange5m}; pc1h=${c.priceChange1h}`
      ]);

    } catch (e) {
      // Ignore unroutable, but keep a tiny debug trail when DEBUG=1.
      if (process.env.DEBUG === '1') {
        console.error('compute failed for', mint, 'pair', pair?.baseToken?.symbol, '/', pair?.quoteToken?.symbol, '-', String(e?.message || e));
      }
    }
  }

  const doc = loadProposals();
  // keep only recent unfilled proposals (last 6h) + add new
  const cutoff = Date.now() - 6 * 3600 * 1000;
  const kept = (doc.proposals || []).filter(p => {
    const t = Date.parse(p.createdAt || '') || 0;
    return t >= cutoff && (p.status === 'PROPOSED' || p.status === 'READY');
  });
  doc.updatedAt = nowIso();
  doc.proposals = [...proposalsOut, ...kept].slice(0, 50);
  saveProposals(doc);

  // Print top 3 to stdout for easy copy/paste into chat.
  const top = proposalsOut.slice(0, 3);
  console.log(JSON.stringify({ updatedAt: doc.updatedAt, proposals: top }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
