#!/usr/bin/env node
/**
 * monitor-trade.mjs - Monitor current trade and alert on close
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STATE_FILE = path.join(HERE, 'cycle_state.json');
const MEMORY_DIR = '/home/j/.openclaw/workspace/memory';
const ALERT_FILE = path.join(MEMORY_DIR, 'trade-alert.json');

const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

async function monitor() {
  console.log('👀 Monitoring active trade...\n');
  
  let lastStage = null;
  let alertedTrades = new Set();
  
  // Load previously alerted trades
  if (fs.existsSync(ALERT_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
      alertedTrades = new Set(data.alertedTrades || []);
    } catch {}
  }
  
  while (true) {
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    
    if (!fs.existsSync(STATE_FILE)) continue;
    
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      
      // Track stage changes
      if (state.stage !== lastStage) {
        console.log(`[${new Date().toLocaleTimeString()}] Stage: ${state.stage} ${state.current?.symbol || ''}`);
        lastStage = state.stage;
      }
      
      // Alert on trade completion (SOLD stage)
      if (state.stage === 'SOLD' && state.current?.symbol) {
        const tradeKey = `${state.current.symbol}-${state.sellSig || Date.now()}`;
        
        if (!alertedTrades.has(tradeKey)) {
          console.log('\n🎯 TRADE CLOSED:');
          console.log(`   Token: ${state.current.symbol}`);
          console.log(`   Exit Reason: ${state.exitReason || 'UNKNOWN'}`);
          console.log(`   Entry: $${state.entryPriceUsd}`);
          console.log(`   Exit: $${state.exitPriceUsd}`);
          console.log(`   P&L: ${state.pnlPct?.toFixed(2)}%`);
          console.log('');
          
          alertedTrades.add(tradeKey);
          
          // Save alert state
          fs.mkdirSync(MEMORY_DIR, { recursive: true });
          fs.writeFileSync(ALERT_FILE, JSON.stringify({
            alertedTrades: Array.from(alertedTrades),
            lastUpdate: new Date().toISOString(),
          }, null, 2));
        }
      }
      
      // Show live P&L for HOLD stage
      if (state.stage === 'HOLD' && state.entryPriceUsd && state.lastPriceUsd) {
        const pnl = ((state.lastPriceUsd - state.entryPriceUsd) / state.entryPriceUsd * 100);
        const tpDist = ((state.tpPrice - state.lastPriceUsd) / state.lastPriceUsd * 100);
        const slDist = ((state.lastPriceUsd - state.slPrice) / state.lastPriceUsd * 100);
        
        process.stdout.write(`\r${state.current?.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}% | TP: ${tpDist.toFixed(2)}% away | SL: ${slDist.toFixed(2)}% buffer    `);
      }
      
    } catch (err) {
      // Skip parsing errors
    }
  }
}

monitor().catch(console.error);
