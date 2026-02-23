// Demo: Scan markets + predict outcomes

import { scanCryptoMarkets } from './market_scanner.mjs';
import CryptoPredictionEngine from './predictor.mjs';

const predictor = new CryptoPredictionEngine();

console.log('=== POLYMARKET CRYPTO TRADING BOT DEMO ===\n');

// Scan for crypto markets
console.log('Step 1: Scanning for crypto markets...\n');
const markets = await scanCryptoMarkets();

if (markets.length === 0) {
  console.log('No crypto markets found at this time.');
  process.exit(0);
}

// Pick first interesting market
const market = markets[0];

console.log('\n' + '='.repeat(70));
console.log('Step 2: Analyzing market with prediction engine...\n');

// Run prediction
const prediction = await predictor.predictMarket(market);

console.log('\n' + '='.repeat(70));
console.log('Step 3: Trading Decision\n');

if (Math.abs(prediction.edge) >= 10 && parseFloat(prediction.confidence) >= 70) {
  console.log('✅ BET OPPORTUNITY!');
  console.log(`   Action: ${prediction.recommendation}`);
  console.log(`   Size: $10 (max position)`);
  console.log(`   Expected Value: +$${(prediction.edge * 0.1).toFixed(2)}`);
} else {
  console.log('⏭️  SKIP - Criteria not met');
  console.log(`   Reason: Edge ${prediction.edge.toFixed(1)}% or Confidence ${prediction.confidence}%`);
}

console.log('\n' + '='.repeat(70));
console.log('\n📊 DEMO COMPLETE');
console.log('\nTo enable real trading:');
console.log('1. Fund Polygon wallet with USDC');
console.log('2. Install @polymarket/order-utils');
console.log('3. Configure private key');
console.log('4. Run: node auto_trader.mjs');
