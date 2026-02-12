#!/usr/bin/env node
/**
 * autoTrade.mjs - Auto-start trading when entry criteria met
 * Combines entry monitoring with auto-trade execution
 */

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Connection, Keypair } from '@solana/web3.js';
import { spawn } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STATE_FILE = path.join(HERE, 'cycle_state.json');
const TRENDING_FILE = path.join(HERE, 'trending_tokens_feb9.json');

// Entry criteria (same as monitorEntries.mjs)
const MIN_1M_CHANGE = 1;
const MIN_5MIN_CHANGE = 2;
const MIN_1H_CHANGE = 10;
const MIN_VOL_RATIO = 1.5;
const MIN_BUY_RATIO = 55;

const CHECK_INTERVAL_MS = 60000; // Check every 60s
const priceHistory = new Map();

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
      volRatio,
      buyRatio,
    };
  } catch (err) {
    return null;
  }
}

function evaluateEntry(data) {
  if (!data) return { signal: 'ERROR', reason: 'Failed to fetch data' };
  
  const { m1, m5, h1, volRatio, buyRatio } = data;
  
  const checks = {
    m1Pumping: m1 >= MIN_1M_CHANGE,
    m5Positive: m5 >= MIN_5MIN_CHANGE,
    h1Strong: h1 >= MIN_1H_CHANGE,
    volumeStrong: volRatio >= MIN_VOL_RATIO,
    buysHealthy: buyRatio >= MIN_BUY_RATIO
  };
  
  const passedAll = Object.values(checks).every(v => v);
  
  if (passedAll) {
    return {
      signal: 'GOOD',
      reason: `✅ ALL CRITERIA MET: 1m: +${m1.toFixed(1)}%, 5m: +${m5.toFixed(1)}%, 1h: +${h1.toFixed(1)}%, Vol: ${volRatio.toFixed(1)}x, Buys: ${buyRatio.toFixed(0)}%`,
      score: m1 * 2 + m5 + h1 + volRatio * 10
    };
  }
  
  if (checks.m5Positive && checks.h1Strong && volRatio >= 1.0) {
    if (m1 < MIN_1M_CHANGE) {
      return {
        signal: 'WAIT',
        reason: `⏸️  Good setup but waiting for 1m pump: 1m: ${m1.toFixed(1)}%, 5m: +${m5.toFixed(1)}%, 1h: +${h1.toFixed(1)}%`,
        score: 0
      };
    }
    return {
      signal: 'MODERATE',
      reason: `🟡 Good momentum, lower volume: 1m: +${m1.toFixed(1)}%, 5m: +${m5.toFixed(1)}%, 1h: +${h1.toFixed(1)}%, Vol: ${volRatio.toFixed(1)}x`,
      score: m1 * 2 + m5 + h1 + volRatio * 5
    };
  }
  
  return {
    signal: 'WAIT',
    reason: `⏸️  No clear signal: 1m: ${m1.toFixed(1)}%, 5m: ${m5.toFixed(1)}%, 1h: ${h1.toFixed(1)}%, Vol: ${volRatio.toFixed(1)}x`,
    score: 0
  };
}

async function startMomentumBot(tokenMint, tokenSymbol) {
  console.log(`\n🚀 Starting momentum bot on ${tokenSymbol}...`);
  
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      MAIN_WALLET: '1',
      SOLANA_RPC: process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC,
      SWAP_WALLET: process.env.SWAP_WALLET || path.join(HERE, 'wallets', 'generated_keypair.json'),
      TARGET_MINT: tokenMint,
      TARGET_SYMBOL: tokenSymbol
    };
    
    const bot = spawn('node', ['./momentumCycle.mjs'], { cwd: HERE, env, stdio: 'inherit' });
    
    bot.on('close', (code) => {
      console.log(`\n🛑 Bot exited with code ${code}`);
      resolve(code);
    });
    
    bot.on('error', (err) => {
      console.error('❌ Bot error:', err);
      reject(err);
    });
  });
}

async function monitor() {
  console.log('🤖 Auto-Trading Monitor Started');
  console.log(`   Criteria: 1m ≥${MIN_1M_CHANGE}% | 5m ≥${MIN_5MIN_CHANGE}% | 1h ≥${MIN_1H_CHANGE}% | Vol ≥${MIN_VOL_RATIO}x | Buys ≥${MIN_BUY_RATIO}%\n`);
  console.log('   Will automatically start trading when GOOD entry signal detected!\n');
  
  while (true) {
    await sleep(CHECK_INTERVAL_MS);
    
    if (!fs.existsSync(TRENDING_FILE)) {
      console.log(`[${new Date().toLocaleTimeString()}] No trending list yet`);
      continue;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(TRENDING_FILE, 'utf8'));
      const tokens = data?.trending || [];
      
      if (tokens.length === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] No tokens in list`);
        continue;
      }
      
      console.log(`\n[${new Date().toLocaleTimeString()}] Checking ${tokens.length} token(s)...`);
      
      let bestEntry = null;
      let bestScore = 0;
      
      for (const t of tokens) {
        const analysis = await analyzeToken(t.mint, t.symbol);
        if (!analysis) continue;
        
        const entry = evaluateEntry(analysis);
        
        console.log(`  ${t.symbol}: ${entry.signal} - ${entry.reason}`);
        
        if (entry.signal === 'GOOD' && entry.score > bestScore) {
          bestEntry = { token: t, analysis, entry };
          bestScore = entry.score;
        }
      }
      
      if (bestEntry) {
        console.log(`\n🎯 GOOD ENTRY SIGNAL DETECTED!`);
        console.log(`   Token: ${bestEntry.token.symbol}`);
        console.log(`   ${bestEntry.entry.reason}`);
        console.log(`\n🚀 AUTO-STARTING TRADING BOT...\n`);
        
        // Start the momentum bot
        await startMomentumBot(bestEntry.token.mint, bestEntry.token.symbol);
        
        // After bot exits, continue monitoring
        console.log('\n🔄 Resuming monitoring for next opportunity...\n');
      }
      
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

monitor().catch(console.error);
