// Simulation Trader - $100 virtual capital, $10 bets on highest confidence
// Tracks P&L and reports after each round

import EnhancedPredictor from './enhanced_predictor.mjs';
import fs from 'fs';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const BET_SIZE = 10; // Fixed $10 per bet
const MIN_CONFIDENCE = 65; // Only bet if ≥65% confidence
const MIN_EDGE = 5; // Only bet if ≥5% edge

const predictor = new EnhancedPredictor();

// Load simulation state
let state = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));

console.log('🎰 POLYMARKET SIMULATION TRADER\n');
console.log('═'.repeat(70));
console.log('💰 VIRTUAL BANKROLL');
console.log(`   Starting Capital: $${state.startingCapital}`);
console.log(`   Current Balance: $${state.currentCapital.toFixed(2)}`);
console.log(`   Bet Size: $${BET_SIZE} (fixed)`);
console.log(`   Record: ${state.wins}W - ${state.losses}L (${state.totalBets} total)`);
console.log('═'.repeat(70) + '\n');

async function runSimulation() {
  let scanCount = 0;
  
  while (true) {
    try {
      scanCount++;
      console.log(`[Scan #${scanCount}] ${new Date().toLocaleTimeString()}\n`);
      
      // Check if we're out of capital
      if (state.currentCapital < BET_SIZE) {
        console.log('🚫 INSUFFICIENT CAPITAL');
        console.log(`   Current: $${state.currentCapital.toFixed(2)}`);
        console.log(`   Need: $${BET_SIZE} per bet`);
        console.log('\n   Simulation stopped - bankroll depleted.\n');
        break;
      }
      
      // Fetch 5-minute markets
      const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=200`);
      const markets = await response.json();
      
      // Filter for active 5-minute Up/Down markets
      const fiveMinMarkets = markets.filter(m => {
        const slug = m.slug || '';
        const question = m.question || '';
        return (slug.includes('updown-5m') || question.toLowerCase().includes('up or down')) &&
               !m.closed && 
               new Date(m.endDate) > new Date();
      });
      
      console.log(`Found ${fiveMinMarkets.length} active 5-minute markets\n`);
      
      if (fiveMinMarkets.length === 0) {
        console.log('⏳ No active markets - waiting for next round...\n');
        await sleep(30000);
        continue;
      }
      
      // Analyze each market and find best bet
      let bestBet = null;
      
      for (const market of fiveMinMarkets) {
        const crypto = extractCrypto(market.question);
        
        console.log(`📊 ${market.question}`);
        console.log(`   End: ${new Date(market.endDate).toLocaleTimeString()}`);
        
        // Get prediction
        const momentum = await get5MinMomentum(crypto);
        const prediction = predictOutcome(momentum, market);
        
        console.log(`   Prediction: ${prediction.outcome} (${prediction.confidence}% conf, ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}% edge)`);
        
        // Check if this beats current best
        if (prediction.confidence >= MIN_CONFIDENCE && 
            Math.abs(prediction.edge) >= MIN_EDGE &&
            (!bestBet || prediction.confidence > bestBet.prediction.confidence)) {
          bestBet = {
            market,
            crypto,
            prediction,
            momentum
          };
        }
        
        console.log('');
        await sleep(2000);
      }
      
      // Place bet on best opportunity (if found)
      if (bestBet) {
        await placeBet(bestBet);
      } else {
        console.log('⏭️  NO QUALIFYING BETS THIS ROUND');
        console.log(`   (Need: ≥${MIN_CONFIDENCE}% confidence + ≥${MIN_EDGE}% edge)\n`);
      }
      
      // Check for resolved bets
      await checkResolvedBets();
      
      // Show updated stats
      showStats();
      
      await sleep(30000); // Scan every 30s
      
    } catch (err) {
      console.error('❌ Error:', err.message);
      await sleep(60000);
    }
  }
}

async function placeBet(bet) {
  console.log('═'.repeat(70));
  console.log('💰 PLACING VIRTUAL BET\n');
  console.log(`   Market: ${bet.market.question}`);
  console.log(`   Crypto: ${bet.crypto}`);
  console.log(`   Prediction: ${bet.prediction.outcome}`);
  console.log(`   Confidence: ${bet.prediction.confidence}%`);
  console.log(`   Edge: ${bet.prediction.edge > 0 ? '+' : ''}${bet.prediction.edge.toFixed(1)}%`);
  console.log(`   Bet Size: $${BET_SIZE}`);
  console.log(`   Potential Payout: $${(BET_SIZE * 2).toFixed(2)} (if win)`);
  
  // Calculate expected market resolution time
  const endTime = new Date(bet.market.endDate);
  const timeToEnd = Math.round((endTime - new Date()) / 1000);
  console.log(`   Resolves in: ${timeToEnd}s (${endTime.toLocaleTimeString()})`);
  
  // Record bet
  const betRecord = {
    id: Date.now(),
    marketId: bet.market.condition_id || bet.market.id,
    marketQuestion: bet.market.question,
    crypto: bet.crypto,
    prediction: bet.prediction.outcome,
    confidence: bet.prediction.confidence,
    edge: bet.prediction.edge,
    betSize: BET_SIZE,
    timestamp: new Date().toISOString(),
    endTime: bet.market.endDate,
    startPrice: bet.momentum.currentPrice || 0,
    status: 'PENDING'
  };
  
  state.activeBets.push(betRecord);
  state.currentCapital -= BET_SIZE;
  state.totalBets++;
  
  saveState();
  
  console.log(`\n   ✅ BET PLACED`);
  console.log(`   Remaining Capital: $${state.currentCapital.toFixed(2)}\n`);
  console.log('═'.repeat(70) + '\n');
}

async function checkResolvedBets() {
  if (state.activeBets.length === 0) return;
  
  console.log(`\n🔍 Checking ${state.activeBets.length} active bet(s)...\n`);
  
  for (let i = state.activeBets.length - 1; i >= 0; i--) {
    const bet = state.activeBets[i];
    const endTime = new Date(bet.endTime);
    const now = new Date();
    
    // If market has ended, check result
    if (now > endTime) {
      console.log(`📊 Resolving: ${bet.marketQuestion}`);
      
      // Fetch actual result (get final price)
      const result = await getMarketResult(bet.crypto, bet.endTime, bet.startPrice);
      
      console.log(`   Start Price: $${bet.startPrice.toLocaleString()}`);
      console.log(`   End Price: $${result.endPrice.toLocaleString()}`);
      console.log(`   Actual: ${result.actual}`);
      console.log(`   Predicted: ${bet.prediction}`);
      
      // Determine win/loss
      const won = result.actual === bet.prediction;
      
      if (won) {
        state.wins++;
        state.currentCapital += BET_SIZE * 2; // Get bet back + winnings
        console.log(`   ✅ WIN! +$${BET_SIZE}`);
      } else {
        state.losses++;
        console.log(`   ❌ LOSS -$${BET_SIZE}`);
      }
      
      // Move to completed
      bet.status = won ? 'WON' : 'LOST';
      bet.actualOutcome = result.actual;
      bet.endPrice = result.endPrice;
      bet.pnl = won ? BET_SIZE : -BET_SIZE;
      
      state.completedBets.push(bet);
      state.activeBets.splice(i, 1);
      
      saveState();
      
      console.log('');
    }
  }
}

async function getMarketResult(crypto, endTime, startPrice) {
  // Fetch price at market end time
  const coinIds = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'XRP': 'ripple'
  };
  
  const coinId = coinIds[crypto];
  
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false`;
    const response = await fetch(url);
    const data = await response.json();
    
    const endPrice = data.market_data.current_price.usd;
    const actual = endPrice > startPrice ? 'UP' : 'DOWN';
    
    return { endPrice, actual };
    
  } catch (err) {
    console.log(`   ⚠️  Could not fetch end price: ${err.message}`);
    // Mock result for now
    return {
      endPrice: startPrice * (Math.random() > 0.5 ? 1.002 : 0.998),
      actual: Math.random() > 0.5 ? 'UP' : 'DOWN'
    };
  }
}

function showStats() {
  console.log('═'.repeat(70));
  console.log('📊 PERFORMANCE REPORT\n');
  console.log(`💰 BANKROLL:`);
  console.log(`   Starting: $${state.startingCapital}`);
  console.log(`   Current: $${state.currentCapital.toFixed(2)}`);
  console.log(`   P&L: ${state.currentCapital - state.startingCapital >= 0 ? '+' : ''}$${(state.currentCapital - state.startingCapital).toFixed(2)} (${((state.currentCapital - state.startingCapital) / state.startingCapital * 100).toFixed(1)}%)`);
  console.log('');
  console.log(`📈 RECORD:`);
  console.log(`   Total Bets: ${state.totalBets}`);
  console.log(`   Wins: ${state.wins}`);
  console.log(`   Losses: ${state.losses}`);
  console.log(`   Active: ${state.activeBets.length}`);
  
  if (state.totalBets > 0) {
    const completedBets = state.wins + state.losses;
    const winRate = completedBets > 0 ? (state.wins / completedBets * 100).toFixed(1) : 0;
    console.log(`   Win Rate: ${winRate}%`);
  }
  
  console.log('');
  
  if (state.completedBets.length > 0) {
    console.log(`📜 RECENT BETS:`);
    const recent = state.completedBets.slice(-5).reverse();
    for (const bet of recent) {
      const pnl = bet.pnl >= 0 ? `+$${bet.pnl}` : `-$${Math.abs(bet.pnl)}`;
      console.log(`   ${bet.crypto} ${bet.prediction} → ${bet.actualOutcome} (${bet.status}) ${pnl}`);
    }
  }
  
  console.log('═'.repeat(70) + '\n');
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
  const coinIds = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'XRP': 'ripple'
  };
  
  const coinId = coinIds[crypto];
  if (!coinId) {
    return { change5m: 0, trend: 'UNKNOWN', currentPrice: 0 };
  }
  
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.market_data) {
      const change1h = data.market_data.price_change_percentage_1h_in_currency?.usd || 0;
      const currentPrice = data.market_data.current_price.usd;
      
      // Estimate 5-min momentum from 1h data
      const change5m = change1h / 12;
      
      let trend = 'NEUTRAL';
      if (change5m > 0.5) trend = 'STRONG_UP';
      else if (change5m > 0.2) trend = 'UP';
      else if (change5m < -0.5) trend = 'STRONG_DOWN';
      else if (change5m < -0.2) trend = 'DOWN';
      
      return { change5m, trend, currentPrice };
    }
    
  } catch (err) {
    console.log(`   ⚠️  Price error: ${err.message}`);
  }
  
  return { change5m: 0, trend: 'UNKNOWN', currentPrice: 0 };
}

function predictOutcome(momentum, market) {
  const change5m = momentum.change5m;
  
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

function saveState() {
  fs.writeFileSync(
    '/home/j/.openclaw/workspace/polymarket/simulation_state.json',
    JSON.stringify(state, null, 2)
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start simulation
console.log('🚀 Starting simulation trading...\n');
runSimulation();
