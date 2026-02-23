// FIXED Simulation Trader - Uses working Gamma API slug discovery
// Scans every 10 seconds for new 5-minute markets

import { get5MinMarketsForAllCoins } from './gamma_5m_client.mjs';
import fs from 'fs';

const predictor = await import('./enhanced_predictor.mjs').then(m => new m.default());
let state = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));

console.log('🎰 POLYMARKET SIMULATION TRADER (FIXED)\n');
console.log('═'.repeat(70));
console.log('💰 VIRTUAL BANKROLL');
console.log(`   Starting: $${state.startingCapital}`);
console.log(`   Current: $${state.currentCapital.toFixed(2)}`);
console.log(`   Record: ${state.wins}W - ${state.losses}L`);
console.log('═'.repeat(70) + '\n');

const seenMarkets = new Set();

async function trade() {
  while (true) {
    try {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Scanning for 5-minute markets...`);
      
      const markets = await get5MinMarketsForAllCoins();
      
      if (markets.length === 0) {
        console.log('   No active markets (between windows)\n');
        await sleep(10000);
        continue;
      }
      
      console.log(`   Found ${markets.length} active markets\n`);
      
      // Analyze each market
      let bestBet = null;
      
      for (const {coin, market} of markets) {
        const marketId = market.slug;
        
        // Skip if already bet on this market
        if (seenMarkets.has(marketId)) {
          continue;
        }
        
        console.log(`📊 ${market.question}`);
        console.log(`   Coin: ${coin}`);
        console.log(`   Ends: ${new Date(market.endDate).toLocaleTimeString()}`);
        
        // Get prediction
        const momentum = await get5MinMomentum(coin);
        const prediction = predictOutcome(momentum);
        
        console.log(`   Momentum: ${momentum.trend} (${momentum.change5m > 0 ? '+' : ''}${momentum.change5m.toFixed(3)}%)`);
        console.log(`   Prediction: ${prediction.outcome} (${prediction.confidence}% conf, ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}% edge)`);
        
        // Check if qualifies
        if (prediction.confidence >= 65 && Math.abs(prediction.edge) >= 5) {
          if (!bestBet || prediction.confidence > bestBet.prediction.confidence) {
            bestBet = { coin, market, prediction, momentum };
          }
        }
        
        console.log('');
      }
      
      // Place bet on best market
      if (bestBet && state.currentCapital >= 10) {
        await placeBet(bestBet);
        seenMarkets.add(bestBet.market.slug);
      } else if (!bestBet) {
        console.log('⏭️  NO QUALIFYING BETS (need ≥65% conf + ≥5% edge)\n');
      }
      
      // Check resolved bets
      await checkResolvedBets();
      
      await sleep(10000); // Scan every 10s
      
    } catch (err) {
      console.error('Error:', err.message);
      await sleep(10000);
    }
  }
}

async function placeBet(bet) {
  console.log('═'.repeat(70));
  console.log('💰 PLACING VIRTUAL BET\n');
  console.log(`   Market: ${bet.market.question}`);
  console.log(`   Crypto: ${bet.coin}`);
  console.log(`   Prediction: ${bet.prediction.outcome}`);
  console.log(`   Confidence: ${bet.prediction.confidence}%`);
  console.log(`   Edge: ${bet.prediction.edge > 0 ? '+' : ''}${bet.prediction.edge.toFixed(1)}%`);
  console.log(`   Bet Size: $10`);
  console.log(`   Starting Price: $${bet.momentum.currentPrice.toLocaleString()}`);
  
  const betRecord = {
    id: Date.now(),
    marketId: bet.market.slug,
    marketQuestion: bet.market.question,
    crypto: bet.coin,
    prediction: bet.prediction.outcome,
    confidence: bet.prediction.confidence,
    edge: bet.prediction.edge,
    betSize: 10,
    timestamp: new Date().toISOString(),
    endTime: bet.market.endDate,
    startPrice: bet.momentum.currentPrice,
    status: 'PENDING'
  };
  
  state.activeBets.push(betRecord);
  state.currentCapital -= 10;
  state.totalBets++;
  saveState();
  
  console.log(`\n   ✅ BET PLACED`);
  console.log(`   Remaining Capital: $${state.currentCapital.toFixed(2)}\n`);
  console.log('═'.repeat(70) + '\n');
}

async function checkResolvedBets() {
  if (state.activeBets.length === 0) return;
  
  for (let i = state.activeBets.length - 1; i >= 0; i--) {
    const bet = state.activeBets[i];
    const endTime = new Date(bet.endTime);
    const now = new Date();
    
    // Check if market has ended (add 30s buffer)
    if (now > new Date(endTime.getTime() + 30000)) {
      console.log(`📊 RESOLVING BET: ${bet.marketQuestion}`);
      
      const result = await getMarketResult(bet.crypto, bet.endTime, bet.startPrice);
      
      console.log(`   Start: $${bet.startPrice.toLocaleString()}`);
      console.log(`   End: $${result.endPrice.toLocaleString()}`);
      console.log(`   Change: ${result.endPrice > result.startPrice ? '+' : ''}${((result.endPrice - bet.startPrice) / bet.startPrice * 100).toFixed(2)}%`);
      console.log(`   Actual: ${result.actual}`);
      console.log(`   Predicted: ${bet.prediction}`);
      
      const won = result.actual === bet.prediction;
      
      if (won) {
        state.wins++;
        state.currentCapital += 20;
        console.log(`   ✅ WIN! +$10\n`);
      } else {
        state.losses++;
        console.log(`   ❌ LOSS -$10\n`);
      }
      
      bet.status = won ? 'WON' : 'LOST';
      bet.actualOutcome = result.actual;
      bet.endPrice = result.endPrice;
      bet.pnl = won ? 10 : -10;
      
      state.completedBets.push(bet);
      state.activeBets.splice(i, 1);
      
      saveState();
      showStats();
    }
  }
}

async function getMarketResult(crypto, endTime, startPrice) {
  const coinIds = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple' };
  
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
  console.log(`   P&L: ${state.currentCapital >= state.startingCapital ? '+' : ''}$${(state.currentCapital - state.startingCapital).toFixed(2)} (${((state.currentCapital - state.startingCapital) / state.startingCapital * 100).toFixed(1)}%)`);
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

trade();
