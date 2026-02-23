// Calibration Tracker - Log EVERY market window for algorithm testing
// Goal: Capture all predictions vs actual outcomes to tune confidence thresholds

import { get5MinMarketsForAllCoins } from './gamma_5m_client.mjs';
import { getPrice as getCoinbasePrice } from './coinbase_price.mjs';
import fs from 'fs';

const LOG_FILE = '/home/j/.openclaw/workspace/polymarket/calibration_log.json';

// Load or initialize log
let log = { markets: [], summary: { total: 0, predicted: 0, skipped: 0 } };
if (fs.existsSync(LOG_FILE)) {
  log = JSON.parse(fs.readFileSync(LOG_FILE));
}

console.log('🎯 CALIBRATION TRACKER - Logging All Market Windows\n');
console.log('Goal: Capture predictions vs actual outcomes');
console.log('Use this data to tune confidence thresholds\n');
console.log(`Current log: ${log.markets.length} markets tracked\n`);
console.log('═'.repeat(70) + '\n');

const seenMarkets = new Set(log.markets.map(m => m.slug));

async function track() {
  while (true) {
    try {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Scanning...`);
      
      const markets = await get5MinMarketsForAllCoins();
      
      if (markets.length > 0) {
        console.log(`   Found ${markets.length} active markets\n`);
        
        for (const {coin, market} of markets) {
          if (seenMarkets.has(market.slug)) continue;
          
          const endDate = new Date(market.endDate);
          const startDate = new Date(endDate.getTime() - 300000);
          
          console.log(`📊 NEW WINDOW: ${market.question}`);
          console.log(`   Coin: ${coin}`);
          console.log(`   Window: ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`);
          
          // Get starting price
          const startPrice = await getPrice(coin);
          
          console.log(`   Start Price: $${startPrice.toLocaleString()}`);
          
          // Log this market
          const entry = {
            slug: market.slug,
            coin: coin,
            question: market.question,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            startPrice: startPrice,
            logged: new Date().toISOString()
          };
          
          log.markets.push(entry);
          log.summary.total++;
          seenMarkets.add(market.slug);
          
          saveLog();
          
          console.log(`   ✅ LOGGED (${log.markets.length} total)\n`);
          
          // Schedule resolution check
          const timeToEnd = new Date(market.endDate) - new Date();
          setTimeout(() => resolveMarket(entry), timeToEnd + 60000); // Check 1min after end
        }
      }
      
      await sleep(10000); // Check every 10s
      
    } catch (err) {
      console.error('Error:', err.message);
      await sleep(10000);
    }
  }
}

async function resolveMarket(entry) {
  try {
    console.log(`\n🔍 RESOLVING: ${entry.coin} (${new Date(entry.endTime).toLocaleTimeString()})`);
    
    const endPrice = await getPrice(entry.coin);
    const change = ((endPrice - entry.startPrice) / entry.startPrice) * 100;
    const actual = endPrice > entry.startPrice ? 'UP' : 'DOWN';
    
    console.log(`   Start: $${entry.startPrice.toLocaleString()}`);
    console.log(`   End: $${endPrice.toLocaleString()}`);
    console.log(`   Change: ${change > 0 ? '+' : ''}${change.toFixed(3)}%`);
    console.log(`   Result: ${actual}\n`);
    
    // Update log entry
    const index = log.markets.findIndex(m => m.slug === entry.slug);
    if (index >= 0) {
      log.markets[index].endPrice = endPrice;
      log.markets[index].change = change;
      log.markets[index].actual = actual;
      log.markets[index].resolved = true;
      saveLog();
    }
    
    // Show calibration stats
    showCalibrationStats();
    
  } catch (err) {
    console.error(`   Error resolving ${entry.coin}:`, err.message);
  }
}

function showCalibrationStats() {
  const resolved = log.markets.filter(m => m.resolved);
  
  if (resolved.length === 0) return;
  
  console.log('═'.repeat(70));
  console.log('📊 CALIBRATION DATA\n');
  console.log(`Total Windows Logged: ${log.markets.length}`);
  console.log(`Resolved: ${resolved.length}`);
  console.log(`Pending: ${log.markets.length - resolved.length}\n`);
  
  // Calculate stats by coin
  const coins = ['BTC', 'ETH', 'SOL', 'XRP'];
  
  for (const coin of coins) {
    const coinData = resolved.filter(m => m.coin === coin);
    if (coinData.length === 0) continue;
    
    const ups = coinData.filter(m => m.actual === 'UP').length;
    const avgChange = coinData.reduce((sum, m) => sum + Math.abs(m.change), 0) / coinData.length;
    
    console.log(`${coin}:`);
    console.log(`  Windows: ${coinData.length}`);
    console.log(`  UP: ${ups} (${(ups/coinData.length*100).toFixed(1)}%)`);
    console.log(`  DOWN: ${coinData.length - ups} (${((coinData.length-ups)/coinData.length*100).toFixed(1)}%)`);
    console.log(`  Avg |Change|: ${avgChange.toFixed(3)}%`);
    console.log('');
  }
  
  console.log('═'.repeat(70) + '\n');
}

async function getPrice(crypto) {
  try {
    // Use Coinbase API - fast, reliable, no rate limits
    return await getCoinbasePrice(crypto);
  } catch (err) {
    console.error(`   ❌ Price fetch error for ${crypto}:`, err.message);
    return 0;
  }
}

function saveLog() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start tracking
track();
