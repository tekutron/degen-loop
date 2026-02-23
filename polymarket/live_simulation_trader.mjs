// Live Simulation Trader - Start betting immediately, calibrate as we go
// Strategy: Simple momentum + learning from outcomes

import { get5MinMarketsForAllCoins } from './gamma_5m_client.mjs';
import { getPrice } from './coinbase_price.mjs';
import fs from 'fs';

let state = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));

console.log('🎰 LIVE SIMULATION TRADER - STARTING NOW\n');
console.log('═'.repeat(70));
console.log('💰 BANKROLL: $100.00');
console.log('📊 Strategy: Bet on strongest signal, learn from results');
console.log('💵 Bet Size: $10 per trade');
console.log('🎯 Min Confidence: 55% (aggressive - we need data)');
console.log('═'.repeat(70) + '\n');

const seenMarkets = new Set();
const priceHistory = new Map(); // Track prices for momentum

async function trade() {
  while (true) {
    try {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Scanning...`);
      
      const markets = await get5MinMarketsForAllCoins();
      
      if (markets.length === 0) {
        console.log('   No active markets\n');
        await sleep(10000);
        continue;
      }
      
      console.log(`   Found ${markets.length} active markets\n`);
      
      // Track current prices for all coins
      for (const {coin, market} of markets) {
        if (!seenMarkets.has(market.slug)) {
          const price = await getPrice(coin);
          trackPrice(coin, price);
          
          console.log(`📊 ${coin}: $${price.toLocaleString()}`);
          
          // Get 1-minute momentum
          const momentum = calculate1MinMomentum(coin);
          console.log(`   1min momentum: ${momentum.trend} (${momentum.change > 0 ? '+' : ''}${momentum.change.toFixed(3)}%)`);
        }
      }
      
      console.log('');
      
      // Find best bet
      let bestBet = null;
      
      for (const {coin, market} of markets) {
        if (seenMarkets.has(market.slug)) continue;
        
        const momentum = calculate1MinMomentum(coin);
        const prediction = predictFromMomentum(momentum);
        
        if (prediction.confidence >= 55) {
          if (!bestBet || prediction.confidence > bestBet.prediction.confidence) {
            bestBet = { coin, market, prediction, momentum };
          }
        }
      }
      
      // Place bet if found
      if (bestBet && state.currentCapital >= 10) {
        await placeBet(bestBet);
        seenMarkets.add(bestBet.market.slug);
        
        // Schedule resolution
        const timeToEnd = new Date(bestBet.market.endDate) - new Date();
        setTimeout(() => resolveBet(bestBet), timeToEnd + 60000);
      } else if (!bestBet) {
        console.log('⏭️  NO QUALIFYING BETS (all <55% confidence)\n');
      }
      
      await sleep(15000); // Check every 15s
      
    } catch (err) {
      console.error('Error:', err.message);
      await sleep(10000);
    }
  }
}

function trackPrice(coin, price) {
  if (!priceHistory.has(coin)) {
    priceHistory.set(coin, []);
  }
  priceHistory.get(coin).push({ price, time: Date.now() });
  
  // Keep last 5 minutes
  const fiveMinAgo = Date.now() - (5 * 60 * 1000);
  const filtered = priceHistory.get(coin).filter(p => p.time > fiveMinAgo);
  priceHistory.set(coin, filtered);
}

function calculate1MinMomentum(coin) {
  const history = priceHistory.get(coin);
  if (!history || history.length < 2) {
    return { change: 0, trend: 'UNKNOWN' };
  }
  
  const oneMinAgo = Date.now() - (60 * 1000);
  const oldPrice = history.find(p => p.time <= oneMinAgo);
  const currentPrice = history[history.length - 1];
  
  if (!oldPrice) {
    return { change: 0, trend: 'UNKNOWN' };
  }
  
  const change = ((currentPrice.price - oldPrice.price) / oldPrice.price) * 100;
  
  let trend = 'NEUTRAL';
  if (change > 0.1) trend = 'STRONG_UP';
  else if (change > 0.05) trend = 'UP';
  else if (change < -0.1) trend = 'STRONG_DOWN';
  else if (change < -0.05) trend = 'DOWN';
  
  return { change, trend };
}

function predictFromMomentum(momentum) {
  // Simple strategy: bet in direction of momentum
  // Higher confidence on stronger moves
  
  let outcome = 'UP';
  let confidence = 50;
  let reasoning = '';
  
  if (momentum.trend === 'STRONG_UP') {
    outcome = 'UP';
    confidence = 70;
    reasoning = 'Strong upward momentum (+0.1%+)';
  } else if (momentum.trend === 'UP') {
    outcome = 'UP';
    confidence = 60;
    reasoning = 'Slight upward momentum (+0.05%+)';
  } else if (momentum.trend === 'STRONG_DOWN') {
    outcome = 'DOWN';
    confidence = 70;
    reasoning = 'Strong downward momentum (-0.1%+)';
  } else if (momentum.trend === 'DOWN') {
    outcome = 'DOWN';
    confidence = 60;
    reasoning = 'Slight downward momentum (-0.05%+)';
  } else {
    // Neutral - use slight bias toward DOWN (from calibration data: 75% DOWN)
    outcome = 'DOWN';
    confidence = 55;
    reasoning = 'Neutral momentum, slight DOWN bias (historical data)';
  }
  
  return { outcome, confidence, reasoning };
}

async function placeBet(bet) {
  console.log('═'.repeat(70));
  console.log('💰 PLACING $10 BET\n');
  console.log(`   Market: ${bet.market.question}`);
  console.log(`   Coin: ${bet.coin}`);
  console.log(`   Prediction: ${bet.prediction.outcome}`);
  console.log(`   Confidence: ${bet.prediction.confidence}%`);
  console.log(`   Reasoning: ${bet.prediction.reasoning}`);
  
  const currentPrice = priceHistory.get(bet.coin)[priceHistory.get(bet.coin).length - 1].price;
  
  const betRecord = {
    id: Date.now(),
    marketSlug: bet.market.slug,
    coin: bet.coin,
    question: bet.market.question,
    prediction: bet.prediction.outcome,
    confidence: bet.prediction.confidence,
    reasoning: bet.prediction.reasoning,
    betSize: 10,
    startPrice: currentPrice,
    startTime: new Date().toISOString(),
    endTime: bet.market.endDate,
    status: 'PENDING'
  };
  
  state.activeBets.push(betRecord);
  state.currentCapital -= 10;
  state.totalBets++;
  saveState();
  
  console.log(`\n   ✅ BET PLACED (#${state.totalBets})`);
  console.log(`   Start Price: $${currentPrice.toLocaleString()}`);
  console.log(`   Remaining: $${state.currentCapital.toFixed(2)}`);
  console.log('═'.repeat(70) + '\n');
}

async function resolveBet(bet) {
  try {
    console.log(`\n🔍 RESOLVING BET #${state.totalBets}:`);
    console.log(`   ${bet.coin} - ${bet.prediction.outcome} prediction`);
    
    const endPrice = await getPrice(bet.coin);
    const change = ((endPrice - bet.betRecord?.startPrice || 0) / (bet.betRecord?.startPrice || 1)) * 100;
    const actual = endPrice > (bet.betRecord?.startPrice || 0) ? 'UP' : 'DOWN';
    
    console.log(`   Start: $${(bet.betRecord?.startPrice || 0).toLocaleString()}`);
    console.log(`   End: $${endPrice.toLocaleString()}`);
    console.log(`   Change: ${change > 0 ? '+' : ''}${change.toFixed(3)}%`);
    console.log(`   Actual: ${actual}`);
    
    const index = state.activeBets.findIndex(b => b.marketSlug === bet.market.slug);
    if (index === -1) return;
    
    const betRecord = state.activeBets[index];
    const won = actual === betRecord.prediction;
    
    if (won) {
      state.wins++;
      state.currentCapital += 20;
      console.log(`   ✅ WIN! +$10\n`);
    } else {
      state.losses++;
      console.log(`   ❌ LOSS -$10\n`);
    }
    
    betRecord.endPrice = endPrice;
    betRecord.change = change;
    betRecord.actual = actual;
    betRecord.status = won ? 'WON' : 'LOST';
    betRecord.pnl = won ? 10 : -10;
    
    state.completedBets.push(betRecord);
    state.activeBets.splice(index, 1);
    
    saveState();
    showStats();
    
  } catch (err) {
    console.error(`   Error resolving bet:`, err.message);
  }
}

function showStats() {
  console.log('═'.repeat(70));
  console.log('📊 SESSION STATS\n');
  console.log(`💰 BANKROLL: $${state.currentCapital.toFixed(2)}`);
  console.log(`   P&L: ${state.currentCapital >= 100 ? '+' : ''}$${(state.currentCapital - 100).toFixed(2)} (${((state.currentCapital - 100) / 100 * 100).toFixed(1)}%)`);
  console.log(`\n📈 RECORD: ${state.wins}W - ${state.losses}L (${state.totalBets} total)`);
  
  if (state.wins + state.losses > 0) {
    const winRate = (state.wins / (state.wins + state.losses) * 100).toFixed(1);
    console.log(`   Win Rate: ${winRate}%`);
    
    const avgPnL = ((state.currentCapital - 100) / (state.wins + state.losses)).toFixed(2);
    console.log(`   Avg P&L per bet: $${avgPnL}`);
  }
  
  if (state.completedBets.length > 0) {
    console.log(`\n📜 RECENT BETS:`);
    state.completedBets.slice(-3).reverse().forEach(b => {
      const result = b.status === 'WON' ? '✅' : '❌';
      console.log(`   ${result} ${b.coin} ${b.prediction} → ${b.actual} (${b.confidence}% conf) ${b.pnl >= 0 ? '+' : ''}$${b.pnl}`);
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

// Start trading NOW
trade();
