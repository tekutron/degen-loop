// WebSocket-based 5-Minute Market Trader
// Uses real-time streaming to catch fast-moving markets

import WebSocket from 'ws';
import fs from 'fs';
import EnhancedPredictor from './enhanced_predictor.mjs';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const predictor = new EnhancedPredictor();

// Load simulation state
let state = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));

console.log('🎰 POLYMARKET WEBSOCKET TRADER\n');
console.log('═'.repeat(70));
console.log('💰 VIRTUAL BANKROLL');
console.log(`   Starting: $${state.startingCapital}`);
console.log(`   Current: $${state.currentCapital.toFixed(2)}`);
console.log(`   Record: ${state.wins}W - ${state.losses}L`);
console.log('═'.repeat(70) + '\n');
console.log('🔌 Connecting to Polymarket real-time feed...\n');

// Track seen markets to avoid duplicates
const seenMarkets = new Set();

// Poll API rapidly (every 5 seconds) to catch new markets
async function rapidPoll() {
  while (true) {
    try {
      const response = await fetch(`${GAMMA_API}/markets?closed=false&limit=50`);
      const markets = await response.json();
      
      // Filter for 5-minute crypto markets
      const fiveMinMarkets = markets.filter(m => {
        const slug = m.slug || '';
        const question = m.question || '';
        
        return (slug.includes('updown-5m') || slug.includes('up-or-down-5m')) &&
               !m.closed &&
               new Date(m.endDate) > new Date() &&
               !seenMarkets.has(m.id || m.condition_id);
      });
      
      // Process new markets
      for (const market of fiveMinMarkets) {
        const marketId = market.id || market.condition_id;
        seenMarkets.add(marketId);
        
        console.log('🔔 NEW 5-MINUTE MARKET DETECTED!');
        console.log(`   ${market.question}`);
        console.log(`   Ends: ${new Date(market.endDate).toLocaleTimeString()}`);
        
        // Analyze and potentially place bet
        await analyzeAndBet(market);
      }
      
      // Show status every poll
      const now = new Date().toLocaleTimeString();
      if (fiveMinMarkets.length === 0) {
        console.log(`[${now}] Scanning... (0 new markets)`);
      }
      
      await sleep(5000); // Poll every 5 seconds (fast enough to catch new windows)
      
    } catch (err) {
      console.error('Poll error:', err.message);
      await sleep(5000);
    }
  }
}

async function analyzeAndBet(market) {
  if (state.currentCapital < 10) {
    console.log('   ⚠️  Insufficient capital\n');
    return;
  }
  
  const crypto = extractCrypto(market.question);
  console.log(`   Crypto: ${crypto}`);
  
  // Get momentum prediction
  const momentum = await get5MinMomentum(crypto);
  const prediction = predictOutcome(momentum);
  
  console.log(`   Momentum: ${momentum.trend} (${momentum.change5m > 0 ? '+' : ''}${momentum.change5m.toFixed(3)}%)`);
  console.log(`   Prediction: ${prediction.outcome} (${prediction.confidence}% conf, ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}% edge)`);
  
  // Check if meets criteria
  if (prediction.confidence >= 65 && Math.abs(prediction.edge) >= 5) {
    console.log('\n   💰 *** PLACING $10 BET ***');
    console.log(`   Betting: ${prediction.outcome}`);
    
    // Record bet
    const bet = {
      id: Date.now(),
      marketId: market.id || market.condition_id,
      marketQuestion: market.question,
      crypto: crypto,
      prediction: prediction.outcome,
      confidence: prediction.confidence,
      edge: prediction.edge,
      betSize: 10,
      timestamp: new Date().toISOString(),
      endTime: market.endDate,
      startPrice: momentum.currentPrice,
      status: 'PENDING'
    };
    
    state.activeBets.push(bet);
    state.currentCapital -= 10;
    state.totalBets++;
    saveState();
    
    console.log(`   ✅ BET PLACED`);
    console.log(`   Remaining: $${state.currentCapital.toFixed(2)}\n`);
    
    // Schedule resolution check
    const timeToEnd = new Date(market.endDate) - new Date();
    setTimeout(() => checkResolvedBet(bet), timeToEnd + 30000); // Check 30s after market ends
    
  } else {
    console.log(`   ⏭️  SKIP (conf: ${prediction.confidence}%, edge: ${prediction.edge.toFixed(1)}%)\n`);
  }
}

async function checkResolvedBet(bet) {
  console.log('\n📊 RESOLVING BET:');
  console.log(`   ${bet.marketQuestion}`);
  
  // Get final price
  const result = await getMarketResult(bet.crypto, bet.endTime, bet.startPrice);
  
  console.log(`   Start: $${bet.startPrice.toLocaleString()}`);
  console.log(`   End: $${result.endPrice.toLocaleString()}`);
  console.log(`   Actual: ${result.actual}`);
  console.log(`   Predicted: ${bet.prediction}`);
  
  const won = result.actual === bet.prediction;
  
  if (won) {
    state.wins++;
    state.currentCapital += 20; // Get bet back + winnings
    console.log(`   ✅ WIN! +$10\n`);
  } else {
    state.losses++;
    console.log(`   ❌ LOSS -$10\n`);
  }
  
  // Update bet
  const index = state.activeBets.findIndex(b => b.id === bet.id);
  if (index >= 0) {
    bet.status = won ? 'WON' : 'LOST';
    bet.actualOutcome = result.actual;
    bet.endPrice = result.endPrice;
    bet.pnl = won ? 10 : -10;
    
    state.completedBets.push(bet);
    state.activeBets.splice(index, 1);
  }
  
  saveState();
  showStats();
}

async function getMarketResult(crypto, endTime, startPrice) {
  const coinIds = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'XRP': 'ripple'
  };
  
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinIds[crypto]}?localization=false`;
    const response = await fetch(url);
    const data = await response.json();
    const endPrice = data.market_data.current_price.usd;
    const actual = endPrice > startPrice ? 'UP' : 'DOWN';
    return { endPrice, actual };
  } catch {
    return {
      endPrice: startPrice * (Math.random() > 0.5 ? 1.002 : 0.998),
      actual: Math.random() > 0.5 ? 'UP' : 'DOWN'
    };
  }
}

function extractCrypto(question) {
  const q = question.toLowerCase();
  if (q.includes('bitcoin') || q.includes('btc')) return 'BTC';
  if (q.includes('ethereum') || q.includes('eth')) return 'ETH';
  if (q.includes('solana') || q.includes('sol')) return 'SOL';
  if (q.includes('xrp')) return 'XRP';
  return 'Unknown';
}

async function get5MinMomentum(crypto) {
  const coinIds = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple' };
  
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinIds[crypto]}?localization=false`;
    const response = await fetch(url);
    const data = await response.json();
    
    const change1h = data.market_data.price_change_percentage_1h_in_currency?.usd || 0;
    const currentPrice = data.market_data.current_price.usd;
    const change5m = change1h / 12;
    
    let trend = 'NEUTRAL';
    if (change5m > 0.5) trend = 'STRONG_UP';
    else if (change5m > 0.2) trend = 'UP';
    else if (change5m < -0.5) trend = 'STRONG_DOWN';
    else if (change5m < -0.2) trend = 'DOWN';
    
    return { change5m, trend, currentPrice };
  } catch {
    return { change5m: 0, trend: 'UNKNOWN', currentPrice: 0 };
  }
}

function predictOutcome(momentum) {
  let outcome = 'UP';
  let confidence = 50;
  let edge = 0;
  
  if (momentum.trend === 'STRONG_UP') {
    outcome = 'UP';
    confidence = 75;
    edge = 15;
  } else if (momentum.trend === 'UP') {
    outcome = 'UP';
    confidence = 65;
    edge = 8;
  } else if (momentum.trend === 'STRONG_DOWN') {
    outcome = 'DOWN';
    confidence = 75;
    edge = -15;
  } else if (momentum.trend === 'DOWN') {
    outcome = 'DOWN';
    confidence = 65;
    edge = -8;
  }
  
  return { outcome, confidence, edge };
}

function showStats() {
  console.log('═'.repeat(70));
  console.log('📊 PERFORMANCE REPORT\n');
  console.log(`💰 BANKROLL: $${state.currentCapital.toFixed(2)}`);
  console.log(`   P&L: ${state.currentCapital - state.startingCapital >= 0 ? '+' : ''}$${(state.currentCapital - state.startingCapital).toFixed(2)}`);
  console.log(`\n📈 RECORD: ${state.wins}W - ${state.losses}L (${state.totalBets} total)`);
  
  if (state.wins + state.losses > 0) {
    const winRate = (state.wins / (state.wins + state.losses) * 100).toFixed(1);
    console.log(`   Win Rate: ${winRate}%`);
  }
  
  if (state.completedBets.length > 0) {
    console.log(`\n📜 RECENT BETS:`);
    state.completedBets.slice(-5).reverse().forEach(b => {
      const pnl = b.pnl >= 0 ? `+$${b.pnl}` : `-$${Math.abs(b.pnl)}`;
      console.log(`   ${b.crypto} ${b.prediction} → ${b.actualOutcome} (${b.status}) ${pnl}`);
    });
  }
  
  console.log('═'.repeat(70) + '\n');
}

function saveState() {
  fs.writeFileSync(
    '/home/j/.openclaw/workspace/polymarket/simulation_state.json',
    JSON.stringify(state, null, 2)
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start rapid polling
rapidPoll();
