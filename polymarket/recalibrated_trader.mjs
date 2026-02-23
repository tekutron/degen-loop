// Recalibrated Trader - Contrarian + Baseline Strategy
// Key insight: Momentum in 5-min windows often reverses (mean reversion)

import { get5MinMarketsForAllCoins } from './gamma_5m_client.mjs';
import { getPrice } from './coinbase_price.mjs';
import fs from 'fs';

let state = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));

console.log('🎰 RECALIBRATED TRADER\n');
console.log('═'.repeat(70));
console.log('💰 Current Bankroll: $' + state.currentCapital.toFixed(2));
console.log('📊 Previous Record: ' + state.wins + 'W - ' + state.losses + 'L');
console.log('\n🔄 NEW STRATEGY:');
console.log('  1. CONTRARIAN: Bet OPPOSITE of strong momentum (mean reversion)');
console.log('  2. BASELINE: 50/50 random when momentum is neutral');
console.log('  3. Conservative: Only bet when capital ≥ $10');
console.log('═'.repeat(70) + '\n');

const seenMarkets = new Set();
const priceHistory = new Map();

async function trade() {
  while (true) {
    try {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Scanning...`);
      
      // Check if we can still bet
      if (state.currentCapital < 10) {
        console.log(`   ⚠️  Insufficient capital ($${state.currentCapital.toFixed(2)}) - STOPPING\n`);
        await sleep(60000);
        continue;
      }
      
      const markets = await get5MinMarketsForAllCoins();
      
      if (markets.length === 0) {
        console.log('   No active markets\n');
        await sleep(15000);
        continue;
      }
      
      console.log(`   Found ${markets.length} active markets\n`);
      
      // Track prices
      for (const {coin, market} of markets) {
        if (!seenMarkets.has(market.slug)) {
          const price = await getPrice(coin);
          trackPrice(coin, price);
        }
      }
      
      // Find best bet (ONE per window, highest confidence)
      let bestBet = null;
      
      for (const {coin, market} of markets) {
        if (seenMarkets.has(market.slug)) continue;
        
        const momentum = calculate1MinMomentum(coin);
        const prediction = contrarianPredict(momentum, coin);
        
        console.log(`${coin}: ${momentum.trend} (${momentum.change > 0 ? '+' : ''}${momentum.change.toFixed(3)}%) → Predict ${prediction.outcome} (${prediction.confidence}% conf)`);
        
        if (prediction.confidence >= 50) {
          if (!bestBet || prediction.confidence > bestBet.prediction.confidence) {
            bestBet = { coin, market, prediction, momentum };
          }
        }
      }
      
      console.log('');
      
      // Place ONE bet per window
      if (bestBet) {
        await placeBet(bestBet);
        
        // Mark entire window as seen (don't bet multiple times)
        for (const {market} of markets) {
          seenMarkets.add(market.slug);
        }
        
        // Schedule resolution
        const timeToEnd = new Date(bestBet.market.endDate) - new Date();
        setTimeout(() => resolveBet(bestBet), timeToEnd + 60000);
      } else {
        console.log('⏭️  NO QUALIFYING BETS\n');
      }
      
      await sleep(15000);
      
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
  if (change > 0.15) trend = 'STRONG_UP';
  else if (change > 0.05) trend = 'UP';
  else if (change < -0.15) trend = 'STRONG_DOWN';
  else if (change < -0.05) trend = 'DOWN';
  
  return { change, trend };
}

function contrarianPredict(momentum, coin) {
  let outcome, confidence, reasoning;
  
  // CONTRARIAN: Bet opposite of strong momentum (mean reversion)
  if (momentum.trend === 'STRONG_DOWN') {
    outcome = 'UP';
    confidence = 65;
    reasoning = 'Contrarian: Strong drop likely to bounce';
  } else if (momentum.trend === 'DOWN') {
    outcome = 'UP';
    confidence = 55;
    reasoning = 'Contrarian: Drop may bounce';
  } else if (momentum.trend === 'STRONG_UP') {
    outcome = 'DOWN';
    confidence = 65;
    reasoning = 'Contrarian: Strong rise likely to retrace';
  } else if (momentum.trend === 'UP') {
    outcome = 'DOWN';
    confidence = 55;
    reasoning = 'Contrarian: Rise may retrace';
  } else {
    // Neutral: Use baseline from calibration (12% UP = bias toward DOWN)
    outcome = 'DOWN';
    confidence = 52;
    reasoning = 'Neutral + baseline (88% DOWN historically)';
  }
  
  return { outcome, confidence, reasoning };
}

async function placeBet(bet) {
  console.log('═'.repeat(70));
  console.log('💰 PLACING $10 BET\n');
  console.log(`   ${bet.coin}: ${bet.market.question.split('-')[0].trim()}`);
  console.log(`   Momentum: ${bet.momentum.trend} (${bet.momentum.change > 0 ? '+' : ''}${bet.momentum.change.toFixed(3)}%)`);
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
  
  console.log(`\n   ✅ BET #${state.totalBets} PLACED`);
  console.log(`   Start Price: $${currentPrice.toLocaleString()}`);
  console.log(`   Remaining: $${state.currentCapital.toFixed(2)}`);
  console.log('═'.repeat(70) + '\n');
}

async function resolveBet(bet) {
  try {
    console.log(`\n🔍 RESOLVING BET:`);
    console.log(`   ${bet.coin} - ${bet.prediction.outcome} prediction`);
    
    const endPrice = await getPrice(bet.coin);
    
    const index = state.activeBets.findIndex(b => b.marketSlug === bet.market.slug);
    if (index === -1) {
      console.log('   (Already resolved)');
      return;
    }
    
    const betRecord = state.activeBets[index];
    const change = ((endPrice - betRecord.startPrice) / betRecord.startPrice) * 100;
    const actual = endPrice > betRecord.startPrice ? 'UP' : 'DOWN';
    
    console.log(`   Start: $${betRecord.startPrice.toLocaleString()}`);
    console.log(`   End: $${endPrice.toLocaleString()}`);
    console.log(`   Change: ${change > 0 ? '+' : ''}${change.toFixed(3)}%`);
    console.log(`   Actual: ${actual}`);
    
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
    console.error(`   Error resolving:`, err.message);
  }
}

function showStats() {
  console.log('═'.repeat(70));
  console.log('📊 SESSION STATS\n');
  console.log(`💰 BANKROLL: $${state.currentCapital.toFixed(2)}`);
  console.log(`   P&L: ${state.currentCapital >= 100 ? '+' : ''}$${(state.currentCapital - 100).toFixed(2)} (${((state.currentCapital - 100) / 100 * 100).toFixed(1)}%)`);
  console.log(`\n📈 RECORD: ${state.wins}W - ${state.losses}L`);
  
  if (state.wins + state.losses > 0) {
    const winRate = (state.wins / (state.wins + state.losses) * 100).toFixed(1);
    console.log(`   Win Rate: ${winRate}%`);
  }
  
  if (state.completedBets.length > 0) {
    console.log(`\n📜 LAST 5 BETS:`);
    state.completedBets.slice(-5).reverse().forEach(b => {
      const result = b.status === 'WON' ? '✅' : '❌';
      console.log(`   ${result} ${b.coin} ${b.prediction} → ${b.actual} (${b.confidence}%) ${b.reasoning.slice(0, 30)}`);
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

trade();
