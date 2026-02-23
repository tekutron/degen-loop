// Test Polymarket API to see actual crypto markets

const response = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=200');
const markets = await response.json();

console.log(`Total markets: ${markets.length}\n`);

// Filter for ACTUAL crypto markets
const cryptoMarkets = markets.filter(market => {
  const text = (market.question + ' ' + (market.description || '')).toLowerCase();
  
  // Must contain crypto terms AND price/trading terms
  const hasCrypto = text.match(/bitcoin|btc|ethereum|eth|solana|sol|crypto|cryptocurrency/);
  const hasMarket = text.match(/price|hit|reach|\$\d+k|above|below|all[- ]time high|ath/);
  
  return hasCrypto && hasMarket;
});

console.log(`Crypto price markets: ${cryptoMarkets.length}\n`);

for (const market of cryptoMarkets.slice(0, 15)) {
  console.log(`📊 ${market.question}`);
  console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
  console.log(`   End: ${market.end_date_iso}`);
  console.log('');
}
