// Live Polymarket Monitor - Continuous market scanning with predictions

import { scanCryptoMarkets } from './market_scanner.mjs';
import CryptoPredictionEngine from './predictor.mjs';

const predictor = new CryptoPredictionEngine();

// Enhanced risk parameters
const MAX_BET_SIZE = 10;
const MIN_EDGE = 8;        // Lowered from 10% to find more opportunities
const MIN_CONFIDENCE = 65;  // Lowered from 70% to find more opportunities
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

console.log('🎰 POLYMARKET LIVE MONITOR\n');
console.log('Risk Parameters:');
console.log(`  Max bet: $${MAX_BET_SIZE}`);
console.log(`  Min edge: ${MIN_EDGE}%`);
console.log(`  Min confidence: ${MIN_CONFIDENCE}%`);
console.log(`  Scan interval: ${SCAN_INTERVAL_MS / 60000} minutes\n`);
console.log('='.repeat(70) + '\n');

let scanCount = 0;
let opportunitiesFound = 0;

async function monitorMarkets() {
  while (true) {
    try {
      scanCount++;
      const timestamp = new Date().toLocaleTimeString();
      
      console.log(`[Scan #${scanCount}] ${timestamp}\n`);
      
      // Get crypto markets
      const markets = await scanCryptoMarkets();
      
      if (markets.length === 0) {
        console.log('⚠️  No crypto markets found\n');
        await sleep(SCAN_INTERVAL_MS);
        continue;
      }
      
      console.log(`\n📊 Analyzing ${markets.length} markets...\n`);
      
      // Analyze each market
      for (const market of markets) {
        console.log('─'.repeat(70));
        
        const prediction = await predictor.predictMarket(market);
        
        // Check if opportunity
        const edge = Math.abs(prediction.edge);
        const confidence = parseFloat(prediction.confidence);
        
        if (edge >= MIN_EDGE && confidence >= MIN_CONFIDENCE) {
          opportunitiesFound++;
          
          console.log('\n🎯 BET OPPORTUNITY #' + opportunitiesFound);
          console.log(`   Market: ${market.question}`);
          console.log(`   Prediction: ${prediction.outcome}`);
          console.log(`   Edge: ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}%`);
          console.log(`   Confidence: ${prediction.confidence}%`);
          console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
          console.log(`   Recommendation: ${prediction.recommendation}`);
          
          // Calculate bet size
          const betSize = calculateKellyBet(edge, confidence, MAX_BET_SIZE);
          console.log(`   → Suggested bet: $${betSize}`);
          console.log('');
          
        } else {
          console.log(`⏭️  ${market.question.slice(0, 60)}...`);
          console.log(`   Edge: ${prediction.edge.toFixed(1)}% | Confidence: ${prediction.confidence}%`);
          console.log(`   Reason: ${edge < MIN_EDGE ? 'Edge too low' : 'Confidence too low'}`);
          console.log('');
        }
        
        await sleep(2000); // Rate limit between predictions
      }
      
      // Summary
      console.log('='.repeat(70));
      console.log(`\n📈 Scan #${scanCount} Complete`);
      console.log(`   Markets analyzed: ${markets.length}`);
      console.log(`   Opportunities found (session): ${opportunitiesFound}`);
      console.log(`   Next scan: ${new Date(Date.now() + SCAN_INTERVAL_MS).toLocaleTimeString()}\n`);
      
      await sleep(SCAN_INTERVAL_MS);
      
    } catch (err) {
      console.error('❌ Error:', err.message);
      await sleep(60000); // Wait 1 min on error
    }
  }
}

function calculateKellyBet(edge, confidence, maxBet) {
  // Fractional Kelly (25% of full Kelly)
  const edgeFraction = edge / 100;
  const confidenceFraction = confidence / 100;
  const kellyFraction = edgeFraction * confidenceFraction * 0.25;
  
  const betSize = Math.min(maxBet, maxBet * kellyFraction);
  return Math.max(1, betSize).toFixed(2);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start monitoring
console.log('🚀 Starting continuous market monitoring...\n');
monitorMarkets();
