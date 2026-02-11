#!/usr/bin/env node
/**
 * momentumCycle.mjs - Momentum-based cycling trader
 * Exits when momentum fades, switches to hottest coin immediately
 */

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Connection, Keypair } from '@solana/web3.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STATE_FILE = path.join(HERE, 'momentum_state.json');
const TRADES_FILE = path.join(HERE, 'momentum_trades.json');
const TRENDING_FILE = path.join(HERE, 'trending_tokens_feb9.json');
const WSOL = 'So11111111111111111111111111111111111111112';

const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB', 'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',
]);

function nowIso() { return new Date().toISOString(); }
function writeState(patch) {
  const prev = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const next = { ...prev, ...patch, updatedAt: nowIso() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
}
function appendTrade(trade) {
  let arr = [];
  if (fs.existsSync(TRADES_FILE)) {
    try { arr = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8')); } catch {}
  }
  if (!Array.isArray(arr)) arr = [];
  arr.unshift(trade);
  if (arr.length > 100) arr = arr.slice(0, 100);
  fs.writeFileSync(TRADES_FILE, JSON.stringify(arr, null, 2));
}

async function execNode(file, env) {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    const p = spawn('node', [file], { cwd: HERE, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => {
      if (code === 0) return resolve({ out, err });
      reject(new Error(`Command failed (${code}): node ${file}\nSTDOUT:\n${out}\nSTDERR:\n${err}`));
    });
  });
}

function extractSig(stdout) {
  const m = stdout.match(/\b[1-9A-HJ-NP-Za-km-z]{80,120}\b/);
  return m ? m[0] : '';
}

async function sumTokenRaw(connection, owner, mint) {
  const TOKEN_PROGRAM_ID = new (await import('@solana/web3.js')).PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const TOKEN_2022_PROGRAM_ID = new (await import('@solana/web3.js')).PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
  
  let total = 0n;
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(owner, { programId });
      for (const { account } of accounts.value) {
        const parsed = account.data.parsed.info;
        if (parsed.mint === mint) {
          total += BigInt(parsed.tokenAmount.amount);
        }
      }
    } catch {}
  }
  return total;
}

function loadTrending() {
  if (!fs.existsSync(TRENDING_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(TRENDING_FILE, 'utf8'));
    return Array.isArray(data?.trending) ? data.trending : [];
  } catch {
    return [];
  }
}

async function fetchCurrentMomentum(mint) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const json = await res.json();
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
    const solPairs = pairs.filter((p) => (p?.chainId ?? '').toLowerCase() === 'solana');
    solPairs.sort((a, b) => Number(b?.volume?.h24 ?? 0) - Number(a?.volume?.h24 ?? 0));
    
    const p = solPairs[0];
    if (!p) throw new Error('No pair found');
    
    return {
      priceUsd: Number(p.priceUsd ?? 0),
      priceChange1h: Number(p?.priceChange?.h1 ?? 0),
      volumeH1: Number(p?.volume?.h1 ?? 0),
      volumeH24: Number(p?.volume?.h24 ?? 0),
    };
  } catch (err) {
    throw new Error(`Momentum fetch failed: ${err.message}`);
  }
}

async function main() {
  if (process.env.MAIN_WALLET !== '1') {
    throw new Error('Set MAIN_WALLET=1 to confirm');
  }
  
  const rpcUrl = process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC;
  const walletPath = process.env.SWAP_WALLET || path.join(HERE, 'wallets', 'generated_keypair.json');
  const sizeSol = 0.08;
  const slippageBps = 1000; // 10%
  const tpPct = 5;
  const slPct = 3;
  const pollMs = 3000; // 3 seconds
  
  // Momentum cycling params
  const MIN_ENTRY_MOMENTUM = 10; // Enter if 1h momentum >10%
  const MIN_HOLD_MOMENTUM = 5;   // Exit if 1h momentum drops below 5%
  const VOLUME_DROP_THRESHOLD = 0.30; // Exit if 1h volume drops >30%
  const STALL_TIME_MS = 120000; // 2 minutes no movement = exit
  const TRENDING_REFRESH_MS = 300000; // 5 minutes
  
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');
  
  writeState({
    running: true,
    pid: process.pid,
    strategy: 'momentum-cycling',
    config: { sizeSol, tpPct, slPct, slippageBps, pollMs, MIN_ENTRY_MOMENTUM, MIN_HOLD_MOMENTUM }
  });
  
  let nextTrendingAt = 0;
  
  while (true) {
    const now = Date.now();
    
    // Refresh trending more frequently (every 5 min)
    if (now >= nextTrendingAt) {
      console.log('\n🔄 Refreshing trending tokens...');
      try {
        await execNode('./refreshTrending.mjs', {});
      } catch (err) {
        console.error('⚠️  Refresh failed:', err.message);
      }
      nextTrendingAt = now + TRENDING_REFRESH_MS;
    }
    
    const trending = loadTrending();
    if (trending.length === 0) {
      console.log('⏸️  No trending tokens, waiting...');
      await sleep(10000);
      continue;
    }
    
    // Find coin with strongest current 1h momentum
    let bestToken = null;
    let bestMomentum = MIN_ENTRY_MOMENTUM;
    
    console.log(`\n🔍 Scanning ${trending.length} tokens for highest momentum...`);
    for (const t of trending) {
      if (STABLECOINS.has(t.mint)) continue;
      if (!t.liquidityUsd || t.liquidityUsd < 15000) continue;
      
      try {
        const { priceChange1h } = await fetchCurrentMomentum(t.mint);
        console.log(`   ${t.symbol}: ${priceChange1h.toFixed(1)}% (1h)`);
        
        if (priceChange1h > bestMomentum) {
          bestMomentum = priceChange1h;
          bestToken = t;
        }
      } catch (err) {
        // Skip failed fetches
      }
    }
    
    if (!bestToken) {
      console.log('❌ No tokens with >10% 1h momentum found. Waiting 30s...');
      await sleep(30000);
      continue;
    }
    
    console.log(`\n🎯 Selected: ${bestToken.symbol} with ${bestMomentum.toFixed(1)}% 1h momentum`);
    
    // BUY
    const amountLamports = Math.floor(sizeSol * 1e9);
    writeState({ stage: 'BUY', token: bestToken.symbol, mint: bestToken.mint });
    
    const before = await sumTokenRaw(connection, kp.publicKey, bestToken.mint);
    
    const buyEnv = {
      SOLANA_RPC: rpcUrl,
      SWAP_WALLET: walletPath,
      INPUT_MINT: WSOL,
      OUTPUT_MINT: bestToken.mint,
      AMOUNT_LAMPORTS: String(amountLamports),
      SLIPPAGE_BPS: String(slippageBps),
      TX_VERSION: 'V0',
      MAIN_WALLET: '1'
    };
    
    let buyOut;
    try {
      buyOut = await execNode('./sdkSwap.mjs', buyEnv);
    } catch (err) {
      console.error(`❌ Buy failed for ${bestToken.symbol}:`, err.message.slice(0, 200));
      await sleep(5000);
      continue;
    }
    
    const buySig = extractSig(buyOut.out);
    const after = await sumTokenRaw(connection, kp.publicKey, bestToken.mint);
    const received = after - before;
    
    if (received <= 0n) {
      console.error('❌ No tokens received after buy');
      continue;
    }
    
    const { priceUsd: entryPrice, volumeH1: entryVolume } = await fetchCurrentMomentum(bestToken.mint);
    const tpPrice = entryPrice * (1 + tpPct / 100);
    const slPrice = entryPrice * (1 - slPct / 100);
    
    console.log(`✅ Bought ${bestToken.symbol}`);
    console.log(`   Entry: $${entryPrice} | TP: $${tpPrice.toFixed(6)} (+5%) | SL: $${slPrice.toFixed(6)} (-3%)`);
    console.log(`   Entry momentum: ${bestMomentum.toFixed(1)}% | Entry volume: $${Math.round(entryVolume / 1000)}K`);
    
    const tradeStart = Date.now();
    let lastPriceTime = tradeStart;
    let lastPrice = entryPrice;
    
    writeState({
      stage: 'HOLD',
      entryPrice,
      entryMomentum: bestMomentum,
      entryVolume,
      tpPrice,
      slPrice,
      buySig
    });
    
    appendTrade({
      status: 'OPEN',
      symbol: bestToken.symbol,
      mint: bestToken.mint,
      entryAt: nowIso(),
      entryPrice,
      entryMomentum: bestMomentum,
      entrySig: buySig
    });
    
    // HOLD with momentum monitoring
    let exitReason = '';
    let exitPrice = entryPrice;
    
    while (true) {
      await sleep(pollMs);
      
      try {
        const current = await fetchCurrentMomentum(bestToken.mint);
        exitPrice = current.priceUsd;
        const currentMomentum = current.priceChange1h;
        const volumeRatio = current.volumeH1 / entryVolume;
        const pnl = ((exitPrice - entryPrice) / entryPrice * 100);
        const timeSinceMove = Date.now() - lastPriceTime;
        
        // Track price movement
        if (Math.abs(exitPrice - lastPrice) / lastPrice > 0.001) { // >0.1% move
          lastPriceTime = Date.now();
          lastPrice = exitPrice;
        }
        
        writeState({
          currentPrice: exitPrice,
          currentMomentum,
          pnl: pnl.toFixed(2),
          volumeRatio: (volumeRatio * 100).toFixed(0) + '%'
        });
        
        console.log(`   ${bestToken.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}% | Momentum: ${currentMomentum.toFixed(1)}% | Vol: ${(volumeRatio * 100).toFixed(0)}%`);
        
        // Exit conditions
        if (exitPrice >= tpPrice) {
          exitReason = 'TP';
          console.log('🎯 Take profit hit!');
          break;
        }
        
        if (exitPrice <= slPrice) {
          exitReason = 'SL';
          console.log('🛑 Stop loss hit!');
          break;
        }
        
        if (currentMomentum < MIN_HOLD_MOMENTUM) {
          exitReason = 'MOMENTUM_FADE';
          console.log(`📉 Momentum faded to ${currentMomentum.toFixed(1)}% (below ${MIN_HOLD_MOMENTUM}%)`);
          break;
        }
        
        if (volumeRatio < (1 - VOLUME_DROP_THRESHOLD)) {
          exitReason = 'VOLUME_DROP';
          console.log(`📊 Volume dropped ${((1 - volumeRatio) * 100).toFixed(0)}%`);
          break;
        }
        
        if (timeSinceMove > STALL_TIME_MS) {
          exitReason = 'STALL';
          console.log('⏸️  Price stalled for 2 minutes');
          break;
        }
        
        if (Date.now() - tradeStart > 4 * 60 * 60 * 1000) {
          exitReason = 'TIMEOUT';
          console.log('⏰ Max hold time (4h) reached');
          break;
        }
        
      } catch (err) {
        console.error('⚠️  Momentum check failed:', err.message);
      }
    }
    
    // SELL
    const sellAmount = await sumTokenRaw(connection, kp.publicKey, bestToken.mint);
    if (sellAmount <= 0n) {
      console.log('⚠️  No balance to sell');
      continue;
    }
    
    console.log(`\n💰 Selling ${bestToken.symbol} (${exitReason})...`);
    writeState({ stage: 'SELL', exitReason });
    
    const sellEnv = {
      SOLANA_RPC: rpcUrl,
      SWAP_WALLET: walletPath,
      INPUT_MINT: bestToken.mint,
      OUTPUT_MINT: WSOL,
      AMOUNT_LAMPORTS: String(sellAmount),
      SLIPPAGE_BPS: String(slippageBps),
      TX_VERSION: 'V0',
      MAIN_WALLET: '1'
    };
    
    let sellOut;
    try {
      sellOut = await execNode('./sdkSwap.mjs', sellEnv);
    } catch (err) {
      console.error('❌ Sell failed:', err.message.slice(0, 200));
      await sleep(5000);
      continue;
    }
    
    const sellSig = extractSig(sellOut.out);
    const pnlPct = ((exitPrice - entryPrice) / entryPrice * 100);
    
    console.log(`✅ Sold ${bestToken.symbol}`);
    console.log(`   Exit: $${exitPrice} | P&L: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`);
    
    appendTrade({
      status: 'CLOSED',
      symbol: bestToken.symbol,
      mint: bestToken.mint,
      exitAt: nowIso(),
      exitPrice,
      exitReason,
      pnlPct: Number(pnlPct.toFixed(2)),
      exitSig: sellSig
    });
    
    writeState({ stage: 'COMPLETED', lastPnl: pnlPct.toFixed(2) });
    
    // Brief pause before next trade
    console.log('\n⏳ Waiting 10s before next scan...\n');
    await sleep(10000);
  }
}

process.on('SIGINT', () => {
  writeState({ running: false, stage: 'STOPPED' });
  process.exit(0);
});

process.on('SIGTERM', () => {
  writeState({ running: false, stage: 'STOPPED' });
  process.exit(0);
});

main().catch((err) => {
  writeState({ running: false, stage: 'ERROR', error: err?.message });
  console.error(err);
  process.exit(1);
});
