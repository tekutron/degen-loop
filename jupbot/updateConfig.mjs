#!/usr/bin/env node
/**
 * updateConfig.mjs - Update cycle_state.json with new swing trading parameters
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STATE_FILE = path.join(HERE, 'cycle_state.json');

console.log('📝 Updating trading bot configuration for swing trading...\n');

// Load current state
let state = {};
if (fs.existsSync(STATE_FILE)) {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

// Update parameters for swing trading
const newConfig = {
  ...state,
  sizeSol: 0.08,              // 0.08 SOL per trade (larger positions for swings)
  tpPct: 10,                  // +10% take profit (let winners run)
  slPct: 3,                   // -3% stop loss (realistic for volatility)
  pollMs: 3000,               // 3 second polling (faster reaction time)
  slippageBps: 200,           // 2% slippage (allow for volatility)
  trendingRefreshMs: 3600000, // 1 hour refresh (swing-friendly)
  running: false,             // Don't auto-start
  stage: 'IDLE',
};

fs.writeFileSync(STATE_FILE, JSON.stringify(newConfig, null, 2));

console.log('✅ Configuration updated:\n');
console.log('  Position size:   0.08 SOL (was: 0.03 SOL)');
console.log('  Take profit:     +10% (was: +5%)');
console.log('  Stop loss:       -3% (was: -1.5%)');
console.log('  Price polling:   3s (was: 10s) ⚡ FASTER');
console.log('  Slippage:        2% (was: 1.5%)');
console.log('  List refresh:    1h (was: 10min)');
console.log('\n💡 Swing trading parameters ready!');
console.log('   Run: node degenCycle.mjs start');
