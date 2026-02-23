// Crypto-Only Polymarket Bot
// Focuses on pure crypto price markets only

import EnhancedPredictor from './enhanced_predictor.mjs';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const SCAN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const MIN_EDGE = 8;
const MIN_CONFIDENCE = 65;
const MAX_BET = 10;

const predictor = new EnhancedPredictor();
let scanCount = 0;
let opportunitiesFound = 0;

console.log('🎰 POLYMARKET CRYPTO-ONLY BOT\n');
console.log('FOCUS: Pure crypto price prediction markets');
console.log('FILTERING: Bitcoin, Ethereum, Solana, token launches\n');
console.log('Parameters:');
console.log(`  Min edge: ${MIN_EDGE}%`);
console.log(`  Min confidence: ${MIN_CONFIDENCE}%`);
console.log(`  Max bet: $${MAX_BET}`);
console.log(`  Scan: ${SCAN_INTERVAL_MS / 60000} min\n`);
console.log('='.repeat(70) + '\n');

async function scanCryptoOnly() {
  while (true) {
    try {
      scanCount++;
      console.log(`[Scan #${scanCount}] ${new Date().toLocaleTimeString()}\n`);
      
      const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=200`);
      const markets = await response.json();
      
      // STRICT crypto-only filter
      const cryptoMarkets = markets.filter(market => {
        const text = (market.question + ' ' + (market.description || '')).toLowerCase();
        
        // Must have crypto AND price action
        const hasBTC = text.match(/bitcoin|btc/);
        const hasETH = text.match(/ethereum|eth/);
        const hasSOL = text.match(/solana|sol/);
        const hasToken = text.match(/token|coin|crypto/);
        const hasCrypto = hasBTC || hasETH || hasSOL || hasToken;
        
        // Must have price/market language
        const hasPriceAction = text.match(/price|hit|reach|\$\d+[kmb]|above|below|market cap|fdv|launch|all.time|ath/);
        
        // Exclude non-crypto noise
        const excludeList = [
          'gta', 'fifa', 'world cup', 'nba', 'mvp',
          'harvey weinstein', 'trump', 'election', 'pardon',
          'album', 'rihanna', 'playboi', 'sports',
          'deport', 'prison', 'qualify', 'zelenskyy'
        ];
        const isNoise = excludeList.some(noise => text.includes(noise));
        
        return hasCrypto && hasPriceAction && !isNoise;
      });
      
      console.log(`✅ Found ${cryptoMarkets.length} PURE crypto markets\n`);
      
      if (cryptoMarkets.length === 0) {
        console.log('⚠️  No crypto markets available right now\n');
        console.log(`Next scan: ${new Date(Date.now() + SCAN_INTERVAL_MS).toLocaleTimeString()}\n`);
        await sleep(SCAN_INTERVAL_MS);
        continue;
      }
      
      // Show all crypto markets found
      console.log('📊 CRYPTO MARKETS AVAILABLE:\n');
      for (let i = 0; i < cryptoMarkets.length; i++) {
        const m = cryptoMarkets[i];
        console.log(`${i + 1}. ${m.question}`);
        console.log(`   Vol: $${(m.volume || 0).toLocaleString()} | Liq: $${(m.liquidity || 0).toLocaleString()}`);
      }
      console.log('');
      
      // Analyze each
      for (const market of cryptoMarkets) {
        console.log('─'.repeat(70));
        console.log(`\n📊 ${market.question}\n`);
        
        const prediction = await predictor.predictMarket(market);
        
        const edge = Math.abs(prediction.edge);
        const confidence = parseFloat(prediction.confidence);
        
        if (edge >= MIN_EDGE && confidence >= MIN_CONFIDENCE) {
          opportunitiesFound++;
          
          console.log('\n🎯 *** BET OPPORTUNITY #' + opportunitiesFound + ' ***');
          console.log(`   Prediction: ${prediction.outcome}`);
          console.log(`   Edge: ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}%`);
          console.log(`   Confidence: ${prediction.confidence}%`);
          console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
          
          const betSize = ((edge / 100) * (confidence / 100) * 0.25 * MAX_BET).toFixed(2);
          console.log(`   → BET: $${betSize} on ${prediction.outcome}`);
          console.log('');
          
        } else {
          console.log(`   Edge: ${prediction.edge.toFixed(1)}% | Confidence: ${prediction.confidence}%`);
          console.log(`   → SKIP (${edge < MIN_EDGE ? 'edge low' : 'confidence low'})\n`);
        }
        
        await sleep(3000);
      }
      
      console.log('='.repeat(70));
      console.log(`\n✅ Scan #${scanCount} complete`);
      console.log(`   Crypto markets: ${cryptoMarkets.length}`);
      console.log(`   Bets found (total): ${opportunitiesFound}`);
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

scanCryptoOnly();
