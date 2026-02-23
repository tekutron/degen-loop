// 5M CRYPTO DISTORTION BOT
// Professional quantitative strategy for 5-minute binaries

import { get5MinMarketsForAllCoins } from './gamma_5m_client.mjs';
import { getPrice } from './coinbase_price.mjs';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════
// 0️⃣ GLOBAL SETTINGS
// ═══════════════════════════════════════════════════════════════════════
const CONFIG = {
  BANKROLL: 100,
  BET_SIZE: 10,
  MAX_OPEN_TRADES: 1,
  MAX_TRADES_PER_DAY: 8,
  DAILY_STOP_LOSS: -20,
  DAILY_STOP_WIN: 30,
  MIN_EDGE_POINTS: 9,        // 9 cents mispricing
  MAX_SPREAD: 4,             // max 4 cents spread
  MIN_TIME_REMAINING: 90,    // 1.5 minutes
  MAX_TIME_REMAINING: 240,   // 4 minutes
  MIN_MOVE_2MIN: 0.0025,     // 0.25% move
  VOL_ACCEL_THRESHOLD: 1.4,  // volatility acceleration
  LAG_SPIKE_MOVE: 0.004,     // 0.4% in 45s
  LAG_SPIKE_WINDOW: 45000    // 45 seconds
};

let state = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));
let dailyStats = { date: new Date().toDateString(), pnl: 0, trades: 0 };

// Price history for momentum & volatility calculation
const priceHistory = new Map();

console.log('⚛️  5M CRYPTO DISTORTION BOT\n');
console.log('═'.repeat(70));
console.log(`💰 Bankroll: $${state.currentCapital}`);
console.log(`📊 Strategy: Micro-Brownian + Lag Spike Detection`);
console.log(`💵 Bet Size: $${CONFIG.BET_SIZE} fixed`);
console.log(`🎯 Min Edge: ${CONFIG.MIN_EDGE_POINTS} points`);
console.log(`⚡ Lag Spike: ${CONFIG.LAG_SPIKE_MOVE * 100}% in ${CONFIG.LAG_SPIKE_WINDOW / 1000}s`);
console.log('═'.repeat(70) + '\n');

async function trade() {
  while (true) {
    try {
      // Check daily limits
      if (dailyStats.pnl <= CONFIG.DAILY_STOP_LOSS) {
        console.log(`🛑 DAILY STOP LOSS HIT ($${dailyStats.pnl})\n`);
        await sleep(60000);
        continue;
      }
      
      if (dailyStats.pnl >= CONFIG.DAILY_STOP_WIN) {
        console.log(`🎯 DAILY STOP WIN HIT ($${dailyStats.pnl})\n`);
        await sleep(60000);
        continue;
      }
      
      if (dailyStats.trades >= CONFIG.MAX_TRADES_PER_DAY) {
        console.log(`📊 MAX TRADES HIT (${dailyStats.trades}/${CONFIG.MAX_TRADES_PER_DAY})\n`);
        await sleep(60000);
        continue;
      }
      
      if (state.activeBets.length >= CONFIG.MAX_OPEN_TRADES) {
        console.log(`⏳ Max open trades (${CONFIG.MAX_OPEN_TRADES})\n`);
        await sleep(15000);
        continue;
      }
      
      if (state.currentCapital < CONFIG.BET_SIZE) {
        console.log(`⚠️  Insufficient capital ($${state.currentCapital})\n`);
        await sleep(60000);
        continue;
      }
      
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Scanning markets...`);
      
      // 1️⃣ SCAN ALL MARKETS
      const markets = await get5MinMarketsForAllCoins();
      
      if (markets.length === 0) {
        console.log('   No active markets\n');
        await sleep(15000);
        continue;
      }
      
      // Track prices for all coins
      for (const {coin} of markets) {
        const price = await getPrice(coin);
        trackPrice(coin, price);
      }
      
      // 2️⃣ EVALUATE EACH MARKET
      let bestTrade = null;
      
      for (const {coin, market} of markets) {
        const timeRemaining = (new Date(market.endDate) - new Date()) / 1000;
        
        // Time filter
        if (timeRemaining < CONFIG.MIN_TIME_REMAINING || timeRemaining > CONFIG.MAX_TIME_REMAINING) {
          continue;
        }
        
        const analysis = await analyzeMarket(coin, market, timeRemaining);
        
        if (analysis && analysis.netEdge >= CONFIG.MIN_EDGE_POINTS) {
          if (!bestTrade || Math.abs(analysis.netEdge) > Math.abs(bestTrade.analysis.netEdge)) {
            bestTrade = { coin, market, analysis };
          }
        }
      }
      
      // Execute best trade if found
      if (bestTrade) {
        await executeTrade(bestTrade);
      } else {
        console.log('   ✗ No qualifying setups\n');
      }
      
      await sleep(10000); // Scan every 10s
      
    } catch (err) {
      console.error('Error:', err.message);
      await sleep(10000);
    }
  }
}

async function analyzeMarket(coin, market, timeRemaining) {
  const history = priceHistory.get(coin);
  if (!history || history.length < 25) {
    return null; // Need at least 2.5 min of data
  }
  
  const currentPrice = history[history.length - 1].price;
  
  // 2️⃣ FAST MOMENTUM FILTER
  const price2MinAgo = getPriceNSecondsAgo(coin, 120);
  if (!price2MinAgo) return null;
  
  const move2Min = (currentPrice - price2MinAgo) / price2MinAgo;
  
  if (Math.abs(move2Min) < CONFIG.MIN_MOVE_2MIN) {
    return null; // No volatility
  }
  
  // 3️⃣ VOLATILITY ACCELERATION CHECK
  const vol1Min = calculateVolatility(coin, 60);
  const vol5Min = calculateVolatility(coin, 300);
  
  if (!vol1Min || !vol5Min || vol5Min === 0) return null;
  
  const volAccel = vol1Min / vol5Min;
  
  if (volAccel < CONFIG.VOL_ACCEL_THRESHOLD) {
    return null; // Not accelerating
  }
  
  // 🧠 LAG SPIKE DETECTION (HIGHEST EV)
  const spike = detectLagSpike(coin);
  
  // 4️⃣ SHORT-HORIZON PROBABILITY MODEL
  const sigma = vol1Min; // Use 1-min realized vol
  const timeFactor = Math.sqrt(timeRemaining / 60);
  
  // Assume strike = current price (Polymarket Up/Down contracts)
  const drift = move2Min / 2; // Recent momentum as drift
  const z = (drift) / (sigma * timeFactor + 0.0001);
  
  // Normal CDF approximation
  const theoreticalProb = normalCDF(z);
  const fairPrice = theoreticalProb * 100; // Convert to cents
  
  // 5️⃣ EDGE CALCULATION
  // Assume market mid = 50 (binary Up/Down)
  const marketMid = 50;
  const rawEdge = fairPrice - marketMid;
  const netEdge = rawEdge - 2; // 2 points fees + slippage
  
  // Boost edge if lag spike detected
  const edgeBoost = spike ? 5 : 0;
  const finalEdge = netEdge + edgeBoost;
  
  return {
    currentPrice,
    move2Min,
    volAccel,
    theoreticalProb,
    fairPrice,
    rawEdge,
    netEdge: finalEdge,
    lagSpike: spike,
    direction: finalEdge > 0 ? 'UP' : 'DOWN',
    timeRemaining
  };
}

async function executeTrade(trade) {
  const { coin, market, analysis } = trade;
  
  console.log('═'.repeat(70));
  console.log('💰 TRADE SIGNAL\n');
  console.log(`   ${coin}: ${analysis.direction}`);
  console.log(`   Price: $${analysis.currentPrice.toLocaleString()}`);
  console.log(`   2min move: ${(analysis.move2Min * 100).toFixed(2)}%`);
  console.log(`   Vol Accel: ${analysis.volAccel.toFixed(2)}x`);
  console.log(`   Fair Price: ${analysis.fairPrice.toFixed(1)} cents`);
  console.log(`   Net Edge: ${analysis.netEdge.toFixed(1)} points`);
  if (analysis.lagSpike) {
    console.log(`   🚨 LAG SPIKE DETECTED (+5 points)`);
  }
  console.log(`   Time Left: ${Math.round(analysis.timeRemaining)}s`);
  
  const betRecord = {
    id: Date.now(),
    marketSlug: market.slug,
    coin,
    question: market.question,
    prediction: analysis.direction,
    confidence: Math.min(95, 50 + Math.abs(analysis.netEdge)),
    reasoning: `Distortion: ${analysis.netEdge.toFixed(1)}pts edge`,
    betSize: CONFIG.BET_SIZE,
    startPrice: analysis.currentPrice,
    fairPrice: analysis.fairPrice,
    netEdge: analysis.netEdge,
    lagSpike: analysis.lagSpike,
    startTime: new Date().toISOString(),
    endTime: market.endDate,
    status: 'PENDING'
  };
  
  state.activeBets.push(betRecord);
  state.currentCapital -= CONFIG.BET_SIZE;
  state.totalBets++;
  dailyStats.trades++;
  saveState();
  
  console.log(`\n   ✅ BET #${state.totalBets} PLACED`);
  console.log(`   Remaining: $${state.currentCapital.toFixed(2)}`);
  console.log(`   Daily: ${dailyStats.trades}/${CONFIG.MAX_TRADES_PER_DAY} trades, $${dailyStats.pnl} P&L`);
  console.log('═'.repeat(70) + '\n');
  
  // Schedule resolution
  const timeToEnd = new Date(market.endDate) - new Date();
  setTimeout(() => resolveBet(trade.coin, market.slug), timeToEnd + 60000);
}

async function resolveBet(coin, slug) {
  try {
    const index = state.activeBets.findIndex(b => b.marketSlug === slug);
    if (index === -1) return;
    
    const bet = state.activeBets[index];
    
    console.log(`\n🔍 RESOLVING: ${coin} ${bet.prediction}`);
    
    const endPrice = await getPrice(coin);
    const change = ((endPrice - bet.startPrice) / bet.startPrice) * 100;
    const actual = endPrice > bet.startPrice ? 'UP' : 'DOWN';
    
    console.log(`   Start: $${bet.startPrice.toLocaleString()}`);
    console.log(`   End: $${endPrice.toLocaleString()}`);
    console.log(`   Change: ${change > 0 ? '+' : ''}${change.toFixed(3)}%`);
    console.log(`   Actual: ${actual}`);
    
    const won = actual === bet.prediction;
    
    if (won) {
      state.wins++;
      state.currentCapital += CONFIG.BET_SIZE * 2;
      dailyStats.pnl += CONFIG.BET_SIZE;
      console.log(`   ✅ WIN! +$${CONFIG.BET_SIZE}\n`);
    } else {
      state.losses++;
      dailyStats.pnl -= CONFIG.BET_SIZE;
      console.log(`   ❌ LOSS -$${CONFIG.BET_SIZE}\n`);
    }
    
    bet.endPrice = endPrice;
    bet.change = change;
    bet.actual = actual;
    bet.status = won ? 'WON' : 'LOST';
    bet.pnl = won ? CONFIG.BET_SIZE : -CONFIG.BET_SIZE;
    
    state.completedBets.push(bet);
    state.activeBets.splice(index, 1);
    
    saveState();
    showStats();
    
  } catch (err) {
    console.error(`   Resolution error:`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function trackPrice(coin, price) {
  if (!priceHistory.has(coin)) {
    priceHistory.set(coin, []);
  }
  priceHistory.get(coin).push({ price, time: Date.now() });
  
  // Keep last 10 minutes
  const tenMinAgo = Date.now() - (10 * 60 * 1000);
  const filtered = priceHistory.get(coin).filter(p => p.time > tenMinAgo);
  priceHistory.set(coin, filtered);
}

function getPriceNSecondsAgo(coin, seconds) {
  const history = priceHistory.get(coin);
  if (!history) return null;
  
  const targetTime = Date.now() - (seconds * 1000);
  const closest = history.find(p => p.time <= targetTime);
  
  return closest ? closest.price : null;
}

function calculateVolatility(coin, windowSeconds) {
  const history = priceHistory.get(coin);
  if (!history || history.length < 2) return null;
  
  const cutoff = Date.now() - (windowSeconds * 1000);
  const prices = history.filter(p => p.time > cutoff).map(p => p.price);
  
  if (prices.length < 2) return null;
  
  // Calculate returns
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i-1]) / prices[i-1]);
  }
  
  // Standard deviation
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

function detectLagSpike(coin) {
  const history = priceHistory.get(coin);
  if (!history || history.length < 10) return false;
  
  const now = Date.now();
  const windowStart = now - CONFIG.LAG_SPIKE_WINDOW;
  
  const recentPrices = history.filter(p => p.time > windowStart);
  if (recentPrices.length < 2) return false;
  
  const oldestPrice = recentPrices[0].price;
  const currentPrice = recentPrices[recentPrices.length - 1].price;
  
  const move = Math.abs((currentPrice - oldestPrice) / oldestPrice);
  
  return move >= CONFIG.LAG_SPIKE_MOVE; // 0.4% in 45s
}

function normalCDF(z) {
  // Approximation of standard normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return z > 0 ? 1 - p : p;
}

function showStats() {
  console.log('═'.repeat(70));
  console.log('📊 DISTORTION BOT STATS\n');
  console.log(`💰 BANKROLL: $${state.currentCapital.toFixed(2)}`);
  console.log(`   P&L: ${state.currentCapital >= 100 ? '+' : ''}$${(state.currentCapital - 100).toFixed(2)} (${((state.currentCapital - 100) / 100 * 100).toFixed(1)}%)`);
  console.log(`\n📈 RECORD: ${state.wins}W - ${state.losses}L`);
  console.log(`   Win Rate: ${state.wins + state.losses > 0 ? ((state.wins / (state.wins + state.losses)) * 100).toFixed(1) : 0}%`);
  console.log(`\n📅 TODAY: ${dailyStats.trades} trades, $${dailyStats.pnl} P&L`);
  
  if (state.completedBets.length > 0) {
    console.log(`\n📜 LAST 3 BETS:`);
    state.completedBets.slice(-3).reverse().forEach(b => {
      const result = b.status === 'WON' ? '✅' : '❌';
      const spike = b.lagSpike ? '🚨' : '';
      console.log(`   ${result} ${spike} ${b.coin} ${b.prediction} → ${b.actual} (${b.netEdge.toFixed(1)}pts)`);
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

// Start the bot
trade();
