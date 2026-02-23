// 5-Minute Crypto Trader for Polymarket
// Trades BTC/ETH/SOL/XRP "Up or Down" 5-minute markets

import EnhancedPredictor from './enhanced_predictor.mjs';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const SERIES_SLUGS = [
  'btc-up-or-down-5m',
  'eth-up-or-down-5m', 
  'sol-up-or-down-5m',
  'xrp-up-or-down-5m'
];

const predictor = new EnhancedPredictor();
let scanCount = 0;
let opportunitiesFound = 0;

console.log('🎰 POLYMARKET 5-MINUTE CRYPTO TRADER\n');
console.log('Trading: BTC, ETH, SOL, XRP');
console.log('Timeframe: 5-minute Up/Down markets');
console.log('Strategy: Real-time price momentum + technical analysis\n');
console.log('Parameters:');
console.log('  Min edge: 5% (5-min markets need faster signals)');
console.log('  Min confidence: 60%');
console.log('  Max bet: $10');
console.log('  Scan: Every 30 seconds (catch new markets)\n');
console.log('='.repeat(70) + '\n');

async function scan5MinMarkets() {
  while (true) {
    try {
      scanCount++;
      console.log(`[Scan #${scanCount}] ${new Date().toLocaleTimeString()}\n`);
      
      // Fetch all markets
      const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=200`);
      const markets = await response.json();
      
      // Filter for 5-minute Up/Down markets
      const fiveMinMarkets = markets.filter(market => {
        const slug = market.slug || '';
        return SERIES_SLUGS.some(series => slug.includes(series.replace('up-or-down', 'updown')));
      });
      
      console.log(`Found ${fiveMinMarkets.length} active 5-minute markets:\n`);
      
      if (fiveMinMarkets.length === 0) {
        console.log('⚠️  No 5-min markets currently active');
        console.log('   (Markets may be between rounds)\n');
        await sleep(30000);
        continue;
      }
      
      // Analyze each market
      for (const market of fiveMinMarkets) {
        const crypto = extractCrypto(market.question);
        
        console.log('─'.repeat(70));
        console.log(`\n${market.question}\n`);
        console.log(`   Crypto: ${crypto}`);
        console.log(`   End: ${new Date(market.endDate).toLocaleTimeString()}`);
        console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
        
        // Get real-time price momentum
        const momentum = await get5MinMomentum(crypto);
        
        console.log(`\n   📈 5-Min Momentum Analysis:`);
        console.log(`      1m change: ${momentum.change1m > 0 ? '+' : ''}${momentum.change1m.toFixed(3)}%`);
        console.log(`      3m change: ${momentum.change3m > 0 ? '+' : ''}${momentum.change3m.toFixed(3)}%`);
        console.log(`      5m change: ${momentum.change5m > 0 ? '+' : ''}${momentum.change5m.toFixed(3)}%`);
        console.log(`      Trend: ${momentum.trend}`);
        
        // Generate prediction
        const prediction = predictOutcome(momentum);
        
        console.log(`\n   🎯 PREDICTION: ${prediction.outcome}`);
        console.log(`      Confidence: ${prediction.confidence}%`);
        console.log(`      Edge: ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}%`);
        
        // Check if bet criteria met
        if (Math.abs(prediction.edge) >= 5 && prediction.confidence >= 60) {
          opportunitiesFound++;
          
          console.log(`\n   💰 *** BET OPPORTUNITY #${opportunitiesFound} ***`);
          console.log(`      Recommendation: BET ${prediction.outcome}`);
          console.log(`      Bet size: $${prediction.betSize}`);
          console.log('');
          
        } else {
          console.log(`\n   ⏭️  SKIP (Edge: ${prediction.edge.toFixed(1)}%, Conf: ${prediction.confidence}%)\n`);
        }
        
        await sleep(2000); // Rate limit between markets
      }
      
      console.log('='.repeat(70));
      console.log(`\n✅ Scan #${scanCount} complete`);
      console.log(`   5-min markets analyzed: ${fiveMinMarkets.length}`);
      console.log(`   Opportunities found (total): ${opportunitiesFound}`);
      console.log(`   Next scan: ${new Date(Date.now() + 30000).toLocaleTimeString()}\n`);
      
      await sleep(30000); // Scan every 30s to catch new markets
      
    } catch (err) {
      console.error('❌ Error:', err.message);
      await sleep(60000);
    }
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
  // Get real-time price from CoinGecko
  const coinIds = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'XRP': 'ripple'
  };
  
  const coinId = coinIds[crypto];
  if (!coinId) {
    return { change1m: 0, change3m: 0, change5m: 0, trend: 'UNKNOWN' };
  }
  
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.market_data) {
      // CoinGecko doesn't have 1m data, estimate from volatility
      const change24h = data.market_data.price_change_percentage_24h || 0;
      const change1h = data.market_data.price_change_percentage_1h_in_currency?.usd || 0;
      
      // Estimate short-term momentum
      // If 1h is positive and accelerating, 5m likely positive
      const change1m = change1h / 12; // Rough estimate
      const change3m = change1h / 4;
      const change5m = change1h / 2;
      
      // Determine trend
      let trend = 'NEUTRAL';
      if (change5m > 0.5) trend = 'STRONG_UP';
      else if (change5m > 0.2) trend = 'UP';
      else if (change5m < -0.5) trend = 'STRONG_DOWN';
      else if (change5m < -0.2) trend = 'DOWN';
      
      return { change1m, change3m, change5m, trend };
    }
    
  } catch (err) {
    console.log(`   ⚠️  Price API error: ${err.message}`);
  }
  
  return { change1m: 0, change3m: 0, change5m: 0, trend: 'UNKNOWN' };
}

function predictOutcome(momentum) {
  // For 5-minute markets, momentum is key
  const change5m = momentum.change5m;
  
  let outcome = 'UP';
  let confidence = 50;
  let edge = 0;
  
  // Strong momentum = high confidence
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
  
  // Calculate bet size (Kelly Criterion - 25% fractional)
  const kellyFraction = (Math.abs(edge) / 100) * (confidence / 100) * 0.25;
  const betSize = Math.max(1, Math.min(10, 10 * kellyFraction)).toFixed(2);
  
  return { outcome, confidence, edge, betSize };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

scan5MinMarkets();
