// Improved 5-Minute Market Scanner using Polymarket Gamma API
// Based on official API docs: https://docs.polymarket.com/

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

async function get5MinMarkets() {
  console.log('🔍 Scanning for 5-minute crypto markets via Gamma API...\n');
  
  try {
    // Method 1: Search by slug pattern (most reliable)
    const slugPatterns = ['btc-updown-5m', 'eth-updown-5m', 'sol-updown-5m', 'xrp-updown-5m'];
    const allMarkets = [];
    
    for (const pattern of slugPatterns) {
      const url = `${GAMMA_API}/markets?closed=false&active=true`;
      const response = await fetch(url);
      const markets = await response.json();
      
      // Filter for this crypto's 5m markets
      const filtered = markets.filter(m => 
        m.slug && m.slug.includes(pattern) && 
        !m.closed && 
        new Date(m.endDate) > new Date()
      );
      
      allMarkets.push(...filtered);
    }
    
    console.log(`✅ Found ${allMarkets.length} active 5-minute markets\n`);
    
    for (const market of allMarkets) {
      const crypto = extractCrypto(market.question);
      const endTime = new Date(market.endDate);
      const timeLeft = Math.round((endTime - new Date()) / 1000);
      
      console.log(`📊 ${market.question}`);
      console.log(`   Crypto: ${crypto}`);
      console.log(`   Slug: ${market.slug}`);
      console.log(`   End: ${endTime.toLocaleTimeString()} (${timeLeft}s left)`);
      console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
      
      // Get current odds from tokens
      if (market.markets && market.markets[0]) {
        const m = market.markets[0];
        console.log(`   Current odds: ${m.outcomePrices ? m.outcomePrices.join(' / ') : 'N/A'}`);
        console.log(`   Outcomes: ${m.outcomes ? m.outcomes.join(' / ') : 'N/A'}`);
      }
      
      console.log('');
    }
    
    return allMarkets;
    
  } catch (err) {
    console.error('❌ API Error:', err.message);
    return [];
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

// Test it
const markets = await get5MinMarkets();

if (markets.length === 0) {
  console.log('ℹ️  No active 5-minute markets right now.');
  console.log('   Markets run in discrete 5-minute windows (e.g., 9:50-9:55 PM ET).');
  console.log('   Next window should open soon.\n');
} else {
  console.log(`✅ SUCCESS: Found ${markets.length} tradeable 5-minute markets!`);
}

export { get5MinMarkets };
