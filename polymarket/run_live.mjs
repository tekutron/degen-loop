// Run Live Monitor with Enhanced Predictor

import EnhancedPredictor from './enhanced_predictor.mjs';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const SCAN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const MIN_EDGE = 8;
const MIN_CONFIDENCE = 65;
const MAX_BET = 10;

const predictor = new EnhancedPredictor();
let scanCount = 0;
let opportunitiesFound = 0;

console.log('🎰 POLYMARKET LIVE TRADING BOT\n');
console.log('Parameters:');
console.log(`  Min edge: ${MIN_EDGE}%`);
console.log(`  Min confidence: ${MIN_CONFIDENCE}%`);
console.log(`  Max bet: $${MAX_BET}`);
console.log(`  Scan interval: ${SCAN_INTERVAL_MS / 60000} min\n`);
console.log('='.repeat(70) + '\n');

async function scanAndPredict() {
  while (true) {
    try {
      scanCount++;
      console.log(`[Scan #${scanCount}] ${new Date().toLocaleTimeString()}\n`);
      
      // Fetch markets
      const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=200`);
      const markets = await response.json();
      
      // Filter crypto markets
      const cryptoMarkets = markets.filter(market => {
        const text = (market.question + ' ' + (market.description || '')).toLowerCase();
        const hasCrypto = text.match(/bitcoin|btc|ethereum|eth|solana|sol|crypto|token|coin/);
        const hasPriceAction = text.match(/price|hit|reach|\$\d+[km]|above|below|all[- ]time high|ath|market cap/);
        const isNotNoise = !text.match(/gta|fifa|world cup|album|rihanna|deport|election/) || text.match(/bitcoin|ethereum|solana/);
        return hasCrypto && hasPriceAction && isNotNoise;
      });
      
      console.log(`Found ${cryptoMarkets.length} crypto markets\n`);
      
      if (cryptoMarkets.length === 0) {
        console.log('⚠️  No crypto markets available\n');
        await sleep(SCAN_INTERVAL_MS);
        continue;
      }
      
      // Analyze each
      for (const market of cryptoMarkets) {
        console.log('─'.repeat(70));
        console.log(`\n📊 ${market.question}\n`);
        console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
        console.log(`   Liquidity: $${(market.liquidity || 0).toLocaleString()}`);
        
        const prediction = await predictor.predictMarket(market);
        
        const edge = Math.abs(prediction.edge);
        const confidence = parseFloat(prediction.confidence);
        
        if (edge >= MIN_EDGE && confidence >= MIN_CONFIDENCE) {
          opportunitiesFound++;
          
          console.log('\n🎯 *** BET OPPORTUNITY #' + opportunitiesFound + ' ***');
          console.log(`   Prediction: ${prediction.outcome}`);
          console.log(`   Edge: ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}%`);
          console.log(`   Confidence: ${prediction.confidence}%`);
          console.log(`   Recommendation: ${prediction.recommendation}`);
          
          const betSize = ((edge / 100) * (confidence / 100) * 0.25 * MAX_BET).toFixed(2);
          console.log(`   → BET SIZE: $${betSize}`);
          console.log('');
          
        } else {
          console.log(`   Edge: ${prediction.edge.toFixed(1)}% | Confidence: ${prediction.confidence}%`);
          console.log(`   → SKIP (${edge < MIN_EDGE ? 'edge low' : 'confidence low'})\n`);
        }
        
        await sleep(3000); // Rate limit
      }
      
      console.log('='.repeat(70));
      console.log(`\n✅ Scan #${scanCount} complete`);
      console.log(`   Opportunities found: ${opportunitiesFound} (session total)`);
      console.log(`   Next: ${new Date(Date.now() + SCAN_INTERVAL_MS).toLocaleTimeString()}\n`);
      
      await sleep(SCAN_INTERVAL_MS);
      
    } catch (err) {
      console.error('❌ Error:', err.message);
      await sleep(60000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

scanAndPredict();
