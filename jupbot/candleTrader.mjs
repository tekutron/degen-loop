#!/usr/bin/env node
/**
 * candleTrader.mjs - Candle pattern based trading
 * Builds own candles by tracking price every 30s, detects breakouts
 */

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Connection, Keypair } from '@solana/web3.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STATE_FILE = path.join(HERE, 'candle_state.json');
const TRADES_FILE = path.join(HERE, 'candle_trades.json');
const TRENDING_FILE = path.join(HERE, 'trending_tokens_feb9.json');
const WSOL = 'So11111111111111111111111111111111111111112';

const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB', 'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',
]);

// Strategy params
const MIN_CANDLE_BODY = 2; // Candle body must be >2% (strong move)
const MIN_VOLUME_RATIO = 2.0; // Current 5min volume must be 2x+ average
const MIN_BUY_RATIO = 55; // 55%+ buyers
const LOOKBACK_CANDLES = 5; // Check last 5 candles for breakout

const priceHistory = new Map(); // Store price snapshots for building candles

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

function loadTrending() {
  if (!fs.existsSync(TRENDING_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(TRENDING_FILE, 'utf8'));
    return data?.trending || [];
  } catch { return []; }
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

function extractSig(txt) {
  const m = txt.match(/TX IDs:\s*\[\s*'([^']+)'/);
  return m ? m[1] : '';
}

async function sumTokenRaw(connection, owner, mint) {
  try {
    const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
    const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
    let total = 0n;
    for (const prog of programs) {
      try {
        const ata = getAssociatedTokenAddressSync(new (await import('@solana/web3.js')).PublicKey(mint), owner, false, prog);
        const info = await connection.getTokenAccountBalance(ata);
        if (info?.value?.amount) total += BigInt(info.value.amount);
      } catch {}
    }
    return total;
  } catch { return 0n; }
}

async function fetchTokenData(mint) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url);
    const json = await res.json();
    const pairs = json?.pairs?.filter(p => p?.chainId === 'solana') || [];
    pairs.sort((a, b) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0));
    const p = pairs[0];
    
    if (!p) return null;
    
    const price = Number(p.priceUsd || 0);
    const m5Change = Number(p.priceChange?.m5 || 0);
    const h1Change = Number(p.priceChange?.h1 || 0);
    const vol5m = Number(p.volume?.m5 || 0);
    const vol1h = Number(p.volume?.h1 || 0);
    const volAvg = vol1h / 12; // Average 5min volume
    const volRatio = volAvg > 0 ? (vol5m / volAvg) : 0;
    
    const buys = Number(p.txns?.h24?.buys || 0);
    const sells = Number(p.txns?.h24?.sells || 0);
    const buyRatio = (buys + sells) > 0 ? (buys / (buys + sells)) * 100 : 0;
    
    return {
      price,
      m5Change,
      h1Change,
      vol5m,
      vol1h,
      volRatio,
      buyRatio,
      timestamp: Date.now()
    };
  } catch (err) {
    return null;
  }
}

function analyzeCandlePattern(mint, symbol, currentData) {
  // Get price history for this token
  if (!priceHistory.has(mint)) {
    priceHistory.set(mint, []);
  }
  
  const history = priceHistory.get(mint);
  history.push({
    price: currentData.price,
    timestamp: currentData.timestamp,
    m5Change: currentData.m5Change,
    vol5m: currentData.vol5m,
  });
  
  // Keep only last 10 minutes of data (20 snapshots at 30s intervals)
  const cutoff = Date.now() - 600000;
  const filtered = history.filter(h => h.timestamp > cutoff);
  priceHistory.set(mint, filtered);
  
  // Need at least LOOKBACK_CANDLES + 1 data points
  if (filtered.length < LOOKBACK_CANDLES + 1) {
    return {
      pass: false,
      reason: `Need ${LOOKBACK_CANDLES + 1} data points, have ${filtered.length}`
    };
  }
  
  // Check current candle (last 5min)
  const current = filtered[filtered.length - 1];
  const prev = filtered[filtered.length - 2];
  
  // Is current candle GREEN and STRONG?
  const isGreen = current.m5Change > 0;
  const bodySize = Math.abs(current.m5Change);
  const isStrongBody = bodySize >= MIN_CANDLE_BODY;
  
  // Is price breaking above recent highs?
  const recentPrices = filtered.slice(-LOOKBACK_CANDLES).map(h => h.price);
  const recentHigh = Math.max(...recentPrices.slice(0, -1)); // Exclude current
  const isBreakout = current.price > recentHigh;
  
  // Volume confirmation
  const hasVolumeSpike = currentData.volRatio >= MIN_VOLUME_RATIO;
  
  // Buy ratio
  const healthyBuys = currentData.buyRatio >= MIN_BUY_RATIO;
  
  // Are we in an uptrend? (higher lows over last 3 candles)
  const last3 = filtered.slice(-4, -1); // Last 3 before current
  let higherLows = true;
  for (let i = 1; i < last3.length; i++) {
    if (last3[i].price < last3[i-1].price) {
      higherLows = false;
      break;
    }
  }
  
  const checks = {
    green: isGreen,
    strongBody: isStrongBody,
    breakout: isBreakout,
    volume: hasVolumeSpike,
    buys: healthyBuys,
    uptrend: higherLows
  };
  
  const passedAll = Object.values(checks).every(v => v);
  
  if (passedAll) {
    return {
      pass: true,
      score: bodySize + currentData.volRatio * 10,
      reason: `✅ BREAKOUT: Green ${bodySize.toFixed(1)}%, Above ${recentHigh.toFixed(8)}, Vol ${currentData.volRatio.toFixed(1)}x, Uptrend`
    };
  }
  
  return {
    pass: false,
    reason: `❌ ${!isGreen ? 'Red' : !isStrongBody ? 'Weak body' : !isBreakout ? 'No breakout' : !hasVolumeSpike ? 'Low volume' : !healthyBuys ? 'Low buys' : 'No uptrend'}`
  };
}

async function main() {
  if (process.env.MAIN_WALLET !== '1') {
    throw new Error('Set MAIN_WALLET=1 to confirm');
  }
  
  const rpcUrl = process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC;
  const walletPath = process.env.SWAP_WALLET || path.join(HERE, 'wallets', 'generated_keypair.json');
  const sizeSol = 0.05;
  const slippageBps = 1000;
  const tpPct = 5;
  const slPct = 3;
  const pollMs = 3000;
  const TRENDING_REFRESH_MS = 60000; // 1 minute
  const SCAN_INTERVAL_MS = 30000; // Scan every 30 seconds (build our own candles)
  
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');
  const amountLamports = Math.floor(sizeSol * 1e9);
  
  writeState({
    running: true,
    pid: process.pid,
    strategy: 'candle-breakout',
    config: { sizeSol, tpPct, slPct, slippageBps, MIN_CANDLE_BODY, MIN_VOLUME_RATIO, MIN_BUY_RATIO }
  });
  
  let nextTrendingAt = 0;
  
  while (true) {
    const now = Date.now();
    
    // Refresh trending list
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
      await sleep(SCAN_INTERVAL_MS);
      continue;
    }
    
    // Scan for candle breakout patterns
    let bestToken = null;
    let bestScore = 0;
    
    console.log(`\n🕯️ Analyzing ${trending.length} tokens for candle breakouts...`);
    for (const t of trending) {
      if (STABLECOINS.has(t.mint)) continue;
      
      const data = await fetchTokenData(t.mint);
      if (!data) continue;
      
      const pattern = analyzeCandlePattern(t.mint, t.symbol, data);
      console.log(`   ${t.symbol}: ${pattern.reason}`);
      
      if (pattern.pass && pattern.score > bestScore) {
        bestToken = { ...t, data, pattern };
        bestScore = pattern.score;
      }
    }
    
    if (!bestToken) {
      console.log('⏸️  No breakout patterns detected, waiting...');
      await sleep(SCAN_INTERVAL_MS);
      continue;
    }
    
    console.log(`\n🎯 BREAKOUT DETECTED: ${bestToken.symbol} (score: ${bestScore.toFixed(1)})`);
    console.log(`   ${bestToken.pattern.reason}`);
    
    // BUY
    writeState({
      stage: 'BUY',
      token: bestToken.symbol,
      mint: bestToken.mint
    });
    
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
    
    const entryPrice = bestToken.data.price;
    const entryVolume = bestToken.data.vol1h;
    const tpPrice = entryPrice * (1 + tpPct / 100);
    const slPrice = entryPrice * (1 - slPct / 100);
    
    console.log(`✅ Bought ${bestToken.symbol}`);
    console.log(`   Entry: $${entryPrice.toFixed(8)} | TP: $${tpPrice.toFixed(8)} (+5%) | SL: $${slPrice.toFixed(8)} (-3%)`);
    
    const tradeStart = Date.now();
    let lastPriceTime = tradeStart;
    let lastPrice = entryPrice;
    
    writeState({
      stage: 'HOLD',
      entryPrice,
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
      entrySig: buySig
    });
    
    // HOLD with candle monitoring
    let exitReason = '';
    let exitPrice = entryPrice;
    
    while (true) {
      await sleep(pollMs);
      
      try {
        const current = await fetchTokenData(bestToken.mint);
        if (!current) continue;
        
        exitPrice = current.price;
        const pnl = ((exitPrice - entryPrice) / entryPrice * 100);
        const volumeRatio = current.vol1h / entryVolume;
        const timeSinceMove = Date.now() - lastPriceTime;
        
        if (Math.abs(exitPrice - lastPrice) / lastPrice > 0.001) {
          lastPriceTime = Date.now();
          lastPrice = exitPrice;
        }
        
        writeState({
          currentPrice: exitPrice,
          currentM5: current.m5Change,
          pnl: pnl.toFixed(2),
          volumeRatio: (volumeRatio * 100).toFixed(0) + '%'
        });
        
        console.log(`   ${bestToken.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}% | 5m: ${current.m5Change.toFixed(1)}% | Vol: ${(volumeRatio * 100).toFixed(0)}%`);
        
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
        
        // Bearish candle reversal (5min turns red and strong)
        if (current.m5Change < -2) {
          exitReason = 'BEARISH_REVERSAL';
          console.log('🔴 Bearish reversal candle detected!');
          break;
        }
        
        // Volume death
        if (volumeRatio < 0.5) {
          exitReason = 'VOLUME_DROP';
          console.log('📊 Volume died!');
          break;
        }
        
        // Price stall
        if (timeSinceMove > 120000) {
          exitReason = 'STALL';
          console.log('⏸️  Price stalled!');
          break;
        }
        
      } catch (err) {
        console.error('⚠️  Monitor error:', err.message);
      }
    }
    
    // SELL
    console.log(`\n💰 Selling ${bestToken.symbol} (${exitReason})...`);
    
    const balance = await sumTokenRaw(connection, kp.publicKey, bestToken.mint);
    if (balance === 0n) {
      console.error('❌ No balance to sell');
      continue;
    }
    
    const sellEnv = {
      SOLANA_RPC: rpcUrl,
      SWAP_WALLET: walletPath,
      INPUT_MINT: bestToken.mint,
      OUTPUT_MINT: WSOL,
      AMOUNT_LAMPORTS: String(balance),
      SLIPPAGE_BPS: String(slippageBps),
      TX_VERSION: 'V0',
      MAIN_WALLET: '1'
    };
    
    try {
      const sellOut = await execNode('./sdkSwap.mjs', sellEnv);
      const sellSig = extractSig(sellOut.out);
      const pnl = ((exitPrice - entryPrice) / entryPrice * 100);
      
      console.log(`✅ Sold ${bestToken.symbol}`);
      console.log(`   Exit: $${exitPrice.toFixed(8)} | P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`);
      
      writeState({
        stage: 'IDLE',
        exitReason,
        lastPnl: pnl.toFixed(2)
      });
      
      appendTrade({
        status: 'CLOSED',
        symbol: bestToken.symbol,
        mint: bestToken.mint,
        exitAt: nowIso(),
        exitPrice,
        exitReason,
        pnlPct: parseFloat(pnl.toFixed(2)),
        exitSig: sellSig
      });
      
    } catch (err) {
      console.error('❌ Sell failed:', err.message.slice(0, 200));
    }
    
    console.log('\n⏳ Waiting 10s before next scan...\n');
    await sleep(10000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
