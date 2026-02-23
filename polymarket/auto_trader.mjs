// Polymarket Auto-Trader
// Scans markets, predicts outcomes, places bets automatically

import { scanCryptoMarkets, getMarketDetails } from './market_scanner.mjs';
import CryptoPredictionEngine from './predictor.mjs';

const predictor = new CryptoPredictionEngine();

// Risk management
const MAX_BET_SIZE = 10; // $10 USDC per bet
const MIN_EDGE = 10;     // Minimum 10% edge to place bet
const MIN_CONFIDENCE = 70; // Minimum 70% confidence

async function autoTrade() {
  console.log('[Polymarket Auto-Trader] Starting...\n');
  console.log('Risk Parameters:');
  console.log(`  Max bet size: $${MAX_BET_SIZE}`);
  console.log(`  Min edge: ${MIN_EDGE}%`);
  console.log(`  Min confidence: ${MIN_CONFIDENCE}%`);
  console.log('');
  
  while (true) {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Scanning markets...\n`);
      
      // Scan for crypto markets
      const markets = await scanCryptoMarkets();
      
      if (markets.length === 0) {
        console.log('No crypto markets found. Waiting 5 minutes...\n');
        await sleep(5 * 60 * 1000);
        continue;
      }
      
      // Analyze each market
      for (const market of markets.slice(0, 5)) {
        const prediction = await predictor.predictMarket(market);
        
        // Check if bet meets criteria
        if (Math.abs(prediction.edge) >= MIN_EDGE && 
            parseFloat(prediction.confidence) >= MIN_CONFIDENCE) {
          
          console.log('🎯 BET OPPORTUNITY FOUND!');
          console.log(`   Market: ${market.question}`);
          console.log(`   Prediction: ${prediction.outcome}`);
          console.log(`   Edge: ${prediction.edge > 0 ? '+' : ''}${prediction.edge.toFixed(1)}%`);
          console.log(`   Confidence: ${prediction.confidence}%`);
          console.log(`   Recommendation: ${prediction.recommendation}`);
          console.log('');
          
          // Calculate bet size (Kelly Criterion)
          const betSize = calculateBetSize(prediction, MAX_BET_SIZE);
          
          console.log(`   → Placing $${betSize} bet on ${prediction.outcome}`);
          
          // Execute bet
          await placeBet(market, prediction.outcome, betSize);
          
        } else {
          console.log(`⏭️  SKIP: ${market.question.slice(0, 60)}...`);
          console.log(`   Reason: Edge ${prediction.edge.toFixed(1)}% < ${MIN_EDGE}% OR Confidence ${prediction.confidence}% < ${MIN_CONFIDENCE}%`);
          console.log('');
        }
        
        await sleep(2000); // Rate limit between markets
      }
      
      console.log(`\nNext scan in 10 minutes...\n`);
      await sleep(10 * 60 * 1000); // Scan every 10 minutes
      
    } catch (err) {
      console.error('Error in auto-trader:', err.message);
      await sleep(60 * 1000); // Wait 1 min on error
    }
  }
}

function calculateBetSize(prediction, maxBet) {
  // Simplified Kelly Criterion
  const edge = Math.abs(prediction.edge) / 100;
  const confidence = parseFloat(prediction.confidence) / 100;
  
  // Kelly fraction = (edge * confidence)
  const kellyFraction = edge * confidence;
  
  // Use fractional Kelly (25% of full Kelly for safety)
  const safeFraction = kellyFraction * 0.25;
  
  // Apply to max bet
  const betSize = Math.min(maxBet, maxBet * safeFraction);
  
  return Math.max(1, betSize).toFixed(2); // Minimum $1 bet
}

async function placeBet(market, outcome, amount) {
  // TODO: Implement Polymarket SDK integration
  // For now, log what would be placed
  
  console.log('   [SIMULATION MODE - Bet not actually placed]');
  console.log('   To enable real trading:');
  console.log('   1. Get USDC on Polygon');
  console.log('   2. Install @polymarket/order-utils');
  console.log('   3. Configure wallet private key');
  console.log('   4. Implement order creation & submission');
  console.log('');
  
  // Would implement:
  // 1. Create order using Polymarket SDK
  // 2. Sign order with private key
  // 3. Submit to CLOB
  // 4. Wait for fill confirmation
  // 5. Log trade in database
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start auto-trader
autoTrade();
