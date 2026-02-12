#!/usr/bin/env node
/**
 * momentumCycleFixed.mjs - Fixed momentum trader with proper entry criteria
 * Uses 1m/5m/1h momentum gates + volume + buy ratio
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

// Entry criteria (strict gates - NO 1h filter)
const MIN_1M_CHANGE = 1;
const MIN_5MIN_CHANGE = 2;
const MIN_VOL_RATIO = 1.5;
const MIN_BUY_RATIO = 55;

// Exit criteria
const MIN_HOLD_MOMENTUM = 5;
const VOLUME_DROP_THRESHOLD = 0.30;
const STALL_TIME_MS = 120000;

const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB', 'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',
]);

const priceHistory = new Map();

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

async function analyzeToken(mint, symbol) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url);
    const json = await res.json();
    const pairs = json?.pairs?.filter(p => p?.chainId === 'solana') || [];
    pairs.sort((a, b) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0));
    const p = pairs[0];
    
    if (!p) return null;
    
    const m5 = p.priceChange?.m5 || 0;
    const h1 = p.priceChange?.h1 || 0;
    const vol5m = p.volume?.m5 || 0;
    const vol1h = p.volume?.h1 || 0;
    const volRatio = vol1h > 0 ? (vol5m / (vol1h / 12)) : 0;
    
    const buys = p.txns?.h24?.buys || 0;
    const sells = p.txns?.h24?.sells || 0;
    const buyRatio = buys + sells > 0 ? (buys / (buys + sells)) * 100 : 0;
    
    const price = p.priceUsd;
    
    // Calculate 1m momentum
    const now = Date.now();
    let m1 = 0;
    
    if (!priceHistory.has(mint)) {
      priceHistory.set(mint, []);
    }
    
    const history = priceHistory.get(mint);
    history.push({ price, timestamp: now });
    
    const cutoff = now - 120000;
    const filtered = history.filter(h => h.timestamp > cutoff);
    priceHistory.set(mint, filtered);
    
    if (filtered.length >= 2) {
      const oldPrice = filtered[0].price;
      m1 = ((price - oldPrice) / oldPrice) * 100;
    }
    
    return {
      symbol,
      mint,
      price,
      m1,
      m5,
      h1,
      vol5m,
      vol1h,
      volRatio,
      buyRatio,
    };
  } catch (err) {
    return null;
  }
}

function evaluateEntry(data) {
  if (!data) return { pass: false, reason: 'No data' };
  
  const { m1, m5, h1, volRatio, buyRatio } = data;
  
  const checks = {
    m1: m1 >= MIN_1M_CHANGE,
    m5: m5 >= MIN_5MIN_CHANGE,
    vol: volRatio >= MIN_VOL_RATIO,
    buys: buyRatio >= MIN_BUY_RATIO
  };
  
  const passedAll = Object.values(checks).every(v => v);
  
  if (passedAll) {
    return {
      pass: true,
      score: m1 * 3 + m5 * 2 + volRatio * 10,
      reason: `✅ 1m:+${m1.toFixed(1)}% 5m:+${m5.toFixed(1)}% (1h:${h1.toFixed(1)}%) Vol:${volRatio.toFixed(1)}x Buys:${buyRatio.toFixed(0)}%`
    };
  }
  
  return {
    pass: false,
    reason: `❌ Failed: 1m:${m1.toFixed(1)}% 5m:${m5.toFixed(1)}% Vol:${volRatio.toFixed(1)}x Buys:${buyRatio.toFixed(0)}%`
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
  const TRENDING_REFRESH_MS = 300000;
  
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');
  const amountLamports = Math.floor(sizeSol * 1e9);
  
  writeState({
    running: true,
    pid: process.pid,
    strategy: 'momentum-fixed',
    config: { sizeSol, tpPct, slPct, slippageBps, pollMs, MIN_1M_CHANGE, MIN_5MIN_CHANGE, MIN_VOL_RATIO, MIN_BUY_RATIO }
  });
  
  let nextTrendingAt = 0;
  
  while (true) {
    const now = Date.now();
    
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
    
    // Find token that passes ALL entry criteria
    let bestToken = null;
    let bestScore = 0;
    
    console.log(`\n🔍 Scanning ${trending.length} tokens with STRICT entry criteria...`);
    for (const t of trending) {
      if (STABLECOINS.has(t.mint)) continue;
      
      const analysis = await analyzeToken(t.mint, t.symbol);
      if (!analysis) continue;
      
      const entry = evaluateEntry(analysis);
      console.log(`   ${t.symbol}: ${entry.reason}`);
      
      if (entry.pass && entry.score > bestScore) {
        bestToken = { ...t, analysis };
        bestScore = entry.score;
      }
    }
    
    if (!bestToken) {
      console.log('⏸️  No token meets ALL entry criteria, waiting...');
      await sleep(30000);
      continue;
    }
    
    console.log(`\n🎯 Selected: ${bestToken.symbol} (score: ${bestScore.toFixed(1)})`);
    console.log(`   1m: +${bestToken.analysis.m1.toFixed(1)}% | 5m: +${bestToken.analysis.m5.toFixed(1)}% | Vol: ${bestToken.analysis.volRatio.toFixed(1)}x | (1h: ${bestToken.analysis.h1.toFixed(1)}% for reference)`);
    
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
    
    const entryPrice = bestToken.analysis.price;
    const entryVolume = bestToken.analysis.vol1h;
    const tpPrice = entryPrice * (1 + tpPct / 100);
    const slPrice = entryPrice * (1 - slPct / 100);
    
    console.log(`✅ Bought ${bestToken.symbol}`);
    console.log(`   Entry: $${entryPrice} | TP: $${tpPrice.toFixed(6)} (+5%) | SL: $${slPrice.toFixed(6)} (-3%)`);
    
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
    
    // HOLD with momentum monitoring
    let exitReason = '';
    let exitPrice = entryPrice;
    
    while (true) {
      await sleep(pollMs);
      
      try {
        const current = await analyzeToken(bestToken.mint, bestToken.symbol);
        if (!current) continue;
        
        exitPrice = current.price;
        const currentMomentum = current.h1;
        const volumeRatio = current.vol1h / entryVolume;
        const pnl = ((exitPrice - entryPrice) / entryPrice * 100);
        const timeSinceMove = Date.now() - lastPriceTime;
        
        if (Math.abs(exitPrice - lastPrice) / lastPrice > 0.001) {
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
          console.log('📉 Momentum faded below 5%!');
          break;
        }
        
        if (volumeRatio < (1 - VOLUME_DROP_THRESHOLD)) {
          exitReason = 'VOLUME_DROP';
          console.log('📊 Volume dropped >30%!');
          break;
        }
        
        if (timeSinceMove > STALL_TIME_MS) {
          exitReason = 'STALL';
          console.log('⏸️  Price stalled for 2 minutes!');
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
      console.log(`   Exit: $${exitPrice} | P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`);
      
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
