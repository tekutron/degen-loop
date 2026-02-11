#!/usr/bin/env node
/**
 * monitorEntries.mjs - Monitor tokens and alert on good entry signals
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TRENDING_FILE = path.join(HERE, 'trending_tokens_feb9.json');
const MEMORY_DIR = '/home/j/.openclaw/workspace/memory';
const ALERT_FILE = path.join(MEMORY_DIR, 'entry-alerts.json');

const CHECK_INTERVAL_MS = 60000; // Check every 60 seconds

// Entry criteria
const MIN_5MIN_CHANGE = 2;      // +2% in 5min
const MIN_1H_CHANGE = 10;       // +10% in 1h
const MIN_VOL_RATIO = 1.5;      // 5min vol must be 1.5x the 1h average
const MIN_BUY_RATIO = 55;       // 55%+ buys

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
    const liq = p.liquidity?.usd || 0;
    const mc = p.fdv || 0;
    
    return {
      symbol,
      mint,
      price,
      m5,
      h1,
      vol5m,
      vol1h,
      volRatio,
      buyRatio,
      liq,
      mc,
      dexUrl: p.url || `https://dexscreener.com/solana/${mint}`
    };
  } catch (err) {
    return null;
  }
}

function evaluateEntry(data) {
  if (!data) return { signal: 'ERROR', reason: 'Failed to fetch data' };
  
  const { m5, h1, volRatio, buyRatio } = data;
  
  // Check all criteria
  const checks = {
    m5Positive: m5 >= MIN_5MIN_CHANGE,
    h1Strong: h1 >= MIN_1H_CHANGE,
    volumeStrong: volRatio >= MIN_VOL_RATIO,
    buysHealthy: buyRatio >= MIN_BUY_RATIO
  };
  
  const passedAll = Object.values(checks).every(v => v);
  
  if (passedAll) {
    return {
      signal: 'GOOD',
      reason: `✅ ALL CRITERIA MET: 5m: +${m5.toFixed(1)}%, 1h: +${h1.toFixed(1)}%, Vol: ${volRatio.toFixed(1)}x, Buys: ${buyRatio.toFixed(0)}%`,
      score: m5 + h1 + volRatio * 10
    };
  }
  
  // Moderate entry
  if (checks.m5Positive && checks.h1Strong && volRatio >= 1.0) {
    return {
      signal: 'MODERATE',
      reason: `🟡 Good momentum but lower volume: 5m: +${m5.toFixed(1)}%, 1h: +${h1.toFixed(1)}%, Vol: ${volRatio.toFixed(1)}x`,
      score: m5 + h1 + volRatio * 5
    };
  }
  
  // Bad entry - dumping
  if (m5 < -5) {
    return {
      signal: 'BAD',
      reason: `❌ Dumping: 5m: ${m5.toFixed(1)}%`,
      score: 0
    };
  }
  
  // Bad entry - no volume
  if (volRatio < 0.5) {
    return {
      signal: 'BAD',
      reason: `❌ Volume dying: ${volRatio.toFixed(1)}x avg`,
      score: 0
    };
  }
  
  // Wait
  return {
    signal: 'WAIT',
    reason: `⏸️  No clear signal: 5m: ${m5.toFixed(1)}%, 1h: ${h1.toFixed(1)}%, Vol: ${volRatio.toFixed(1)}x`,
    score: 0
  };
}

async function monitor() {
  console.log('👀 Monitoring for good entry signals...');
  console.log(`   Criteria: 5m ≥${MIN_5MIN_CHANGE}% | 1h ≥${MIN_1H_CHANGE}% | Vol ≥${MIN_VOL_RATIO}x | Buys ≥${MIN_BUY_RATIO}%\n`);
  
  let lastAlertTime = {};
  
  while (true) {
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    
    if (!fs.existsSync(TRENDING_FILE)) continue;
    
    try {
      const data = JSON.parse(fs.readFileSync(TRENDING_FILE, 'utf8'));
      const tokens = data?.trending || [];
      
      if (tokens.length === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] No tokens in list`);
        continue;
      }
      
      console.log(`\n[${new Date().toLocaleTimeString()}] Checking ${tokens.length} token(s)...`);
      
      const results = [];
      
      for (const t of tokens) {
        const analysis = await analyzeToken(t.mint, t.symbol);
        if (!analysis) continue;
        
        const entry = evaluateEntry(analysis);
        
        console.log(`  ${t.symbol}: ${entry.signal} - ${entry.reason}`);
        
        if (entry.signal === 'GOOD' || entry.signal === 'MODERATE') {
          // Check if we already alerted recently (don't spam)
          const lastAlert = lastAlertTime[t.mint] || 0;
          const timeSinceAlert = Date.now() - lastAlert;
          
          if (timeSinceAlert > 300000 || entry.signal === 'GOOD') { // 5min cooldown, unless GOOD
            console.log(`\n🎯 ENTRY OPPORTUNITY DETECTED!\n`);
            console.log(`   Token: ${t.symbol}`);
            console.log(`   Signal: ${entry.signal}`);
            console.log(`   ${entry.reason}`);
            console.log(`   Price: $${analysis.price}`);
            console.log(`   Liquidity: $${Math.round(analysis.liq).toLocaleString()}`);
            console.log(`   Market Cap: $${Math.round(analysis.mc).toLocaleString()}`);
            console.log(`   Chart: ${analysis.dexUrl}`);
            console.log('');
            
            lastAlertTime[t.mint] = Date.now();
            
            // Save alert to memory
            fs.mkdirSync(MEMORY_DIR, { recursive: true });
            const alerts = [];
            if (fs.existsSync(ALERT_FILE)) {
              try {
                const existing = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
                alerts.push(...existing.slice(0, 9)); // Keep last 10
              } catch {}
            }
            
            alerts.unshift({
              timestamp: new Date().toISOString(),
              symbol: t.symbol,
              mint: t.mint,
              signal: entry.signal,
              price: analysis.price,
              m5: analysis.m5,
              h1: analysis.h1,
              volRatio: analysis.volRatio,
              buyRatio: analysis.buyRatio,
              dexUrl: analysis.dexUrl
            });
            
            fs.writeFileSync(ALERT_FILE, JSON.stringify(alerts, null, 2));
          }
        }
      }
      
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

monitor().catch(console.error);
