// Find 5-minute crypto markets on Polymarket

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

async function find5MinMarkets() {
  console.log('🔍 Searching for 5-minute crypto markets...\n');
  
  const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=500`);
  const markets = await response.json();
  
  // Look for short-term crypto markets
  const shortTermKeywords = [
    '5 min', '5min', '5-min',
    'next 5', 'within 5',
    'short term', 'short-term',
    'hour', '1h', '1 hour',
    'quick', 'rapid', 'immediate',
    'today', 'tonight', 'this week'
  ];
  
  const cryptoKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol',
    'crypto', 'coin', 'token', 'price'
  ];
  
  const fiveMinMarkets = markets.filter(market => {
    const text = (market.question + ' ' + (market.description || '')).toLowerCase();
    
    const hasShortTerm = shortTermKeywords.some(kw => text.includes(kw));
    const hasCrypto = cryptoKeywords.some(kw => text.includes(kw));
    
    return hasShortTerm && hasCrypto;
  });
  
  console.log(`Found ${fiveMinMarkets.length} short-term crypto markets:\n`);
  
  if (fiveMinMarkets.length === 0) {
    console.log('⚠️  No 5-minute crypto markets found.');
    console.log('\nSearching for any time-based crypto markets...\n');
    
    // Broader search - any crypto with time component
    const timeBasedMarkets = markets.filter(market => {
      const text = (market.question + ' ' + (market.description || '')).toLowerCase();
      
      const hasCrypto = cryptoKeywords.some(kw => text.includes(kw));
      const hasTime = text.match(/\d+\s*(min|minute|hour|hr|day|week|month)/);
      const hasPrice = text.match(/price|hit|reach|\$\d+|above|below|higher|lower/);
      
      return hasCrypto && (hasTime || hasPrice);
    });
    
    console.log(`Found ${timeBasedMarkets.length} time-based crypto markets:\n`);
    
    for (const market of timeBasedMarkets.slice(0, 20)) {
      console.log(`📊 ${market.question}`);
      console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
      console.log(`   End: ${market.endDateIso || 'N/A'}`);
      console.log('');
    }
    
    return timeBasedMarkets;
  }
  
  for (const market of fiveMinMarkets) {
    console.log(`📊 ${market.question}`);
    console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
    console.log(`   Liquidity: $${(market.liquidity || 0).toLocaleString()}`);
    console.log(`   End: ${market.endDateIso || 'N/A'}`);
    console.log('');
  }
  
  return fiveMinMarkets;
}

const markets = await find5MinMarkets();

console.log('\n' + '='.repeat(70));
console.log(`\n💡 POLYMARKET 5-MIN MARKETS INFO:`);
console.log('\nPolymarket may not have traditional "5-minute" markets like forex/binary options.');
console.log('Most crypto markets are longer-term (hours/days/weeks).');
console.log('\nAlternatives:');
console.log('1. Trade shortest-duration markets available');
console.log('2. Use hourly/daily markets with quick scalping');
console.log('3. Build our own 5-min predictor for existing markets');
console.log('');
