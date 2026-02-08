// degenCycle.mjs (updated with trade logging)
// Continuous trending buy->TP/SL->sell cycle runner.
// Logs trades to cycle_trades.json

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
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

const PID_FILE = path.join(HERE, 'cycle.pid');
const STATE_FILE = path.join(HERE, 'cycle_state.json');
const TRADES_FILE = path.join(HERE, 'cycle_trades.json');

const WSOL = 'So11111111111111111111111111111111111111112';
const BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/latest/v1';
const TOKEN_URL = (addr) => `https://api.dexscreener.com/latest/dex/tokens/${addr}`;

// Stablecoins to skip
const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',   // USD1
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',   // USDH
]);

function nowIso() { return new Date().toISOString(); }
function writeState(patch) {
  const prev = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const next = { ...prev, ...patch, updatedAt: nowIso() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + '\n');
}
function appendTrade(trade) {
  let arr = [];
  if (fs.existsSync(TRADES_FILE)) {
    try { arr = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8')); } catch {}
  }
  if (!Array.isArray(arr)) arr = [];
  arr.unshift(trade); // newest first
  if (arr.length > 500) arr = arr.slice(0, 500);
  fs.writeFileSync(TRADES_FILE, JSON.stringify(arr, null, 2) + '\n');
}
function mustEnv(name) { const v = process.env[name]; if (!v) throw new Error(`Missing env ${name}`); return v; }
async function execNode(file, env) { const { spawn } = await import('node:child_process'); return await new Promise((resolve, reject) => { const p = spawn('node', [file], { cwd: HERE, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; let err = ''; p.stdout.on('data', (d) => (out += d.toString())); p.stderr.on('data', (d) => (err += d.toString())); p.on('close', (code) => { if (code === 0) return resolve({ out, err }); reject(new Error(`Command failed (${code}): node ${file}\nSTDOUT:\n${out}\nSTDERR:\n${err}`)); }); }); }
function extractSig(stdout) { const m = stdout.match(/\b[1-9A-HJ-NP-Za-km-z]{80,120}\b/); return m ? m[0] : ''; }
async function sumTokenRaw(connection, ownerPk, mintStr) { const mint = new PublicKey(mintStr); const resp = await connection.getTokenAccountsByOwner(ownerPk, { mint }, 'confirmed'); let total = 0n; for (const { pubkey } of resp.value) { const bal = await connection.getTokenAccountBalance(pubkey, 'confirmed'); total += BigInt(bal.value.amount); } return total; }
async function fetchRaydiumTopVolume1h() {
  // Fetch established Solana tokens with Raydium pairs, sorted by 1h volume
  // Using major tokens + recent boosts that have actual Raydium liquidity
  const majorTokens = [
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
    'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', // JTO  
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
    '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
    'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', // AI16Z
    'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump', // CHILLGUY
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
    'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', // MEW
    'nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7', // NOS
  ];
  
  // Also check top boosted tokens for any with Raydium pairs
  let additionalTokens = [];
  try {
    const boostsRes = await fetch(BOOSTS_URL, { cache: 'no-store' });
    if (boostsRes.ok) {
      const boosts = await boostsRes.json();
      const sol = boosts.filter((b) => (b?.chainId ?? '').toLowerCase() === 'solana' && b?.tokenAddress);
      additionalTokens = sol.slice(0, 30).map((b) => String(b.tokenAddress));
    }
  } catch {}
  
  const allTokens = [...majorTokens, ...additionalTokens];
  const results = [];
  
  for (const addr of allTokens) {
    try {
      const res = await fetch(TOKEN_URL(addr), { cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
      
      // Filter for Raydium pairs on Solana
      const raydiumPairs = pairs.filter((p) => 
        (p?.chainId ?? '').toLowerCase() === 'solana' && 
        (p?.dexId ?? '').toLowerCase() === 'raydium'
      );
      
      if (raydiumPairs.length === 0) continue;
      
      // Sort by 1h volume
      raydiumPairs.sort((a, b) => Number(b?.volume?.h1 ?? 0) - Number(a?.volume?.h1 ?? 0));
      const p = raydiumPairs[0];
      if (!p?.baseToken?.address) continue;
      
      // Skip if we already have this token
      if (results.some(r => r.mint === p.baseToken.address)) continue;
      
      results.push({
        mint: p.baseToken.address,
        symbol: p.baseToken.symbol,
        name: p.baseToken.name,
        priceUsd: Number(p.priceUsd ?? 0),
        dexUrl: p.url,
        volumeH1: Number(p?.volume?.h1 ?? 0),
        volumeH24: Number(p?.volume?.h24 ?? 0),
        liquidityUsd: Number(p?.liquidity?.usd ?? 0),
      });
    } catch { }
  }
  
  // Sort by 1h volume descending and take top 10
  results.sort((a, b) => b.volumeH1 - a.volumeH1);
  return results.slice(0, 10);
}
async function fetchPriceUsdForMint(mint) { const res = await fetch(TOKEN_URL(mint), { cache: 'no-store' }); if (!res.ok) throw new Error(`dexscreener token ${res.status}`); const json = await res.json(); const pairs = Array.isArray(json?.pairs) ? json.pairs : []; const solPairs = pairs.filter((p) => (p?.chainId ?? '').toLowerCase() === 'solana'); solPairs.sort((a, b) => Number(b?.volume?.h24 ?? 0) - Number(a?.volume?.h24 ?? 0)); const p = solPairs[0]; const priceUsd = Number(p?.priceUsd ?? 0); if (!priceUsd) throw new Error('priceUsd missing'); return { priceUsd, url: p?.url }; }

async function main() {
  if (process.env.MAIN_WALLET !== '1') { throw new Error('Refusing to run: set MAIN_WALLET=1 to confirm funded wallet usage.'); }
  const rpcUrl = process.env.SOLANA_RPC || mustEnv('NEXT_PUBLIC_SOLANA_RPC');
  const walletPath = process.env.SWAP_WALLET || path.join(HERE, 'wallets', 'generated_keypair.json');
  const sizeSol = Number(mustEnv('SIZE_SOL'));
  const slippageBps = Number(process.env.SLIPPAGE_BPS || '150');
  const tpPct = Number(process.env.TAKE_PROFIT_PCT || '10');
  const slPct = Number(process.env.STOP_LOSS_PCT || '5');
  const pollMs = Number(process.env.PRICE_POLL_MS || '10000');
  const trendingRefreshMs = Number(process.env.TRENDING_REFRESH_MS || String(10 * 60 * 1000));

  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');

  fs.writeFileSync(PID_FILE, String(process.pid));
  writeState({ running: true, pid: process.pid, rpcUrl, walletPath, sizeSol, slippageBps, tpPct, slPct, pollMs, trendingRefreshMs });

  let trending = [];
  let nextTrendingAt = 0;
  let idx = 0;

  while (true) {
    const now = Date.now();
    if (now >= nextTrendingAt || trending.length === 0) {
      writeState({ stage: 'FETCH_RAYDIUM_TOP_VOLUME' });
      trending = await fetchRaydiumTopVolume1h();
      nextTrendingAt = now + trendingRefreshMs;
      if (trending.length === 0) { writeState({ stage: 'NO_RAYDIUM_PAIRS' }); await sleep(5000); continue; }
      idx = idx % trending.length; writeState({ trending, nextTrendingAt, idx });
    }

    const t = trending[idx];
    if (!t?.mint) { idx = (idx + 1) % trending.length; continue; }
    
    // Skip stablecoins
    if (STABLECOINS.has(t.mint)) {
      writeState({ stage: 'SKIP_STABLECOIN', skipped: t.symbol });
      idx = (idx + 1) % trending.length;
      await sleep(500);
      continue;
    }
    
    // Skip illiquid tokens (need high liquidity for Raydium routes)
    if (!t.liquidityUsd || t.liquidityUsd < 100000) { 
      writeState({ stage: 'SKIP_LOW_LIQ', skipped: t.symbol, liquidityUsd: t.liquidityUsd });
      idx = (idx + 1) % trending.length; 
      await sleep(1000); // brief pause before trying next
      continue; 
    }

    const amountLamports = Math.floor(sizeSol * 1e9);

    // BUY
    writeState({ stage: 'BUY', current: { idx, ...t }, amountLamports });
    const before = await sumTokenRaw(connection, kp.publicKey, t.mint);

    const buyEnv = { SOLANA_RPC: rpcUrl, SWAP_WALLET: walletPath, INPUT_MINT: WSOL, OUTPUT_MINT: t.mint, AMOUNT_LAMPORTS: String(amountLamports), SLIPPAGE_BPS: String(slippageBps), TX_VERSION: 'V0', MAIN_WALLET: '1' };
    let buyOut;
    try {
      buyOut = await execNode('./sdkSwap.mjs', buyEnv);
    } catch (e) {
      const errMsg = e?.message?.slice?.(0, 400) || String(e).slice(0, 400);
      writeState({ stage: 'BUY_ERROR', skipped: t.symbol, error: errMsg });
      console.error(`Buy failed for ${t.symbol}, skipping to next:`, errMsg);
      idx = (idx + 1) % trending.length; // skip token and continue
      await sleep(2000); // brief pause before next attempt
      continue;
    }
    const buySig = extractSig(buyOut.out);

    const after = await sumTokenRaw(connection, kp.publicKey, t.mint);
    const received = after - before;
    if (received <= 0n) { writeState({ stage: 'BUY_FAILED_NO_RECEIVE', buySig, buyStdout: buyOut.out.slice(-500) }); idx = (idx + 1) % trending.length; continue; }

    let entryPriceUsd = 0;
    try {
      ({ priceUsd: entryPriceUsd } = await fetchPriceUsdForMint(t.mint));
    } catch (e) {
      writeState({ stage: 'PRICE_FETCH_ERROR', error: e?.message?.slice?.(0, 200) || String(e).slice(0, 200) });
      idx = (idx + 1) % trending.length;
      continue;
    }
    const tpPrice = entryPriceUsd * (1 + tpPct / 100);
    const slPrice = entryPriceUsd * (1 - slPct / 100);

    const trade = { status: 'OPEN', mint: t.mint, symbol: t.symbol, entryAt: nowIso(), entrySig: buySig, entryPriceUsd, tpPrice, slPrice, amountRaw: String(received), dexUrl: t.dexUrl };
    appendTrade(trade);

    writeState({ stage: 'HOLD', buySig, entryPriceUsd, tpPrice, slPrice, receivedRaw: String(received) });

    // HOLD
    let exitReason = '';
    let exitPrice = entryPriceUsd;
    while (true) {
      await sleep(pollMs);
      const { priceUsd } = await fetchPriceUsdForMint(t.mint);
      exitPrice = priceUsd;
      writeState({ stage: 'HOLD', lastPriceUsd: priceUsd });
      if (priceUsd >= tpPrice) { exitReason = 'TP'; break; }
      if (priceUsd <= slPrice) { exitReason = 'SL'; break; }
      if (Date.now() >= nextTrendingAt) { break; }
    }

    // SELL
    const sellAmount = await sumTokenRaw(connection, kp.publicKey, t.mint);
    if (sellAmount <= 0n) { writeState({ stage: 'SELL_SKIPPED_NO_BALANCE', exitReason }); idx = (idx + 1) % trending.length; continue; }

    writeState({ stage: 'SELL', exitReason, sellAmountRaw: String(sellAmount) });

    const sellEnv = { SOLANA_RPC: rpcUrl, SWAP_WALLET: walletPath, INPUT_MINT: t.mint, OUTPUT_MINT: WSOL, AMOUNT_LAMPORTS: String(sellAmount), SLIPPAGE_BPS: String(slippageBps), TX_VERSION: 'V0', MAIN_WALLET: '1' };
    let sellOut;
    try {
      sellOut = await execNode('./sdkSwap.mjs', sellEnv);
    } catch (e) {
      writeState({ stage: 'SELL_ERROR', error: e?.message?.slice?.(0, 400) || String(e).slice(0, 400) });
      idx = (idx + 1) % trending.length;
      continue;
    }
    const sellSig = extractSig(sellOut.out);

    const pct = entryPriceUsd > 0 ? ((exitPrice / entryPriceUsd) - 1) * 100 : 0;
    appendTrade({ status: 'CLOSED', mint: t.mint, symbol: t.symbol, exitAt: nowIso(), exitSig: sellSig, exitPriceUsd: exitPrice, pnlPct: Number(pct.toFixed(4)) });

    writeState({ stage: 'SOLD', exitReason, sellSig, exitPriceUsd: exitPrice, pnlPct: Number(pct.toFixed(4)) });

    idx = (idx + 1) % trending.length; writeState({ idx });
  }
}

process.on('SIGINT', () => { writeState({ running: false, stage: 'STOPPING' }); try { fs.unlinkSync(PID_FILE); } catch {} process.exit(0); });
process.on('SIGTERM', () => { writeState({ running: false, stage: 'STOPPING' }); try { fs.unlinkSync(PID_FILE); } catch {} process.exit(0); });

main().catch((e) => { writeState({ running: false, stage: 'ERROR', error: e?.message ?? String(e) }); console.error(e); process.exit(1); });
