#!/usr/bin/env node
/**
 * fetchCandles.mjs - Fetch OHLCV candle data from DexScreener
 */

// DexScreener provides candle data in the token pairs response
// We need to test what's available

const mint = process.argv[2] || 'CvZwvj9A9cFePJFM8D4RfwKXixWfi3a55HgnSe8Dpump'; // Rambo as test

async function fetchCandles(mint) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url);
    const json = await res.json();
    
    const pairs = json?.pairs?.filter(p => p?.chainId === 'solana') || [];
    if (pairs.length === 0) {
      console.log('No Solana pairs found');
      return;
    }
    
    pairs.sort((a, b) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0));
    const p = pairs[0];
    
    console.log(`\n📊 Token: ${p.baseToken?.symbol}`);
    console.log(`Pair: ${p.pairAddress}`);
    console.log(`\n💰 Current Price Data:`);
    console.log(`  Price: $${p.priceUsd}`);
    console.log(`  Price Native: ${p.priceNative}`);
    
    console.log(`\n📈 Price Changes (like candle closes):`);
    console.log(`  5min: ${p.priceChange?.m5 || 0}%`);
    console.log(`  1hour: ${p.priceChange?.h1 || 0}%`);
    console.log(`  6hour: ${p.priceChange?.h6 || 0}%`);
    console.log(`  24hour: ${p.priceChange?.h24 || 0}%`);
    
    console.log(`\n📊 Volume (candle volume):`);
    console.log(`  5min: $${Math.round(p.volume?.m5 || 0).toLocaleString()}`);
    console.log(`  1hour: $${Math.round(p.volume?.h1 || 0).toLocaleString()}`);
    console.log(`  24hour: $${Math.round(p.volume?.h24 || 0).toLocaleString()}`);
    
    console.log(`\n💹 Transactions (candle activity):`);
    console.log(`  5min: ${(p.txns?.m5?.buys || 0) + (p.txns?.m5?.sells || 0)} txns`);
    console.log(`  1hour: ${(p.txns?.h1?.buys || 0) + (p.txns?.h1?.sells || 0)} txns`);
    console.log(`  24hour: ${(p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)} txns`);
    
    console.log(`\n🕯️ Candle Analysis:`);
    console.log(`DexScreener doesn't provide full OHLC candles via API.`);
    console.log(`But we can derive candle information:`);
    console.log(`  - Current price = Close of current candle`);
    console.log(`  - Price change % = Candle body direction/size`);
    console.log(`  - Volume = Candle volume`);
    console.log(`\nFor full OHLC, we'd need:`);
    console.log(`  1. Birdeye API (paid, has OHLC data)`);
    console.log(`  2. Build our own by tracking price over time`);
    console.log(`  3. Use Helius RPC + on-chain data`);
    
    console.log(`\n💡 What we CAN do with DexScreener:`);
    console.log(`  ✅ Detect strong green candles (5m % > 0, volume spike)`);
    console.log(`  ✅ Detect breakouts (price > previous highs)`);
    console.log(`  ✅ Volume confirmation (current vol vs average)`);
    console.log(`  ✅ Trend analysis (higher highs from price changes)`);
    console.log(`  ❌ Cannot see wicks/shadows (need OHLC)`);
    console.log(`  ❌ Cannot see exact open/high/low (only close + changes)`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

fetchCandles(mint);
