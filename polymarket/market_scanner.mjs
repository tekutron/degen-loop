// Polymarket Market Scanner - Find crypto prediction markets
// API docs: https://docs.polymarket.com/

// Node 18+ has native fetch, no import needed

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

async function scanCryptoMarkets() {
  console.log('[Polymarket Scanner] Finding crypto markets...\n');
  
  try {
    // Fetch active markets
    const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=100`);
    const markets = await response.json();
    
    // Filter for ACTUAL crypto price markets
    const cryptoMarkets = markets.filter(market => {
      const text = (market.question + ' ' + (market.description || '')).toLowerCase();
      
      // Must have crypto + price action
      const hasCrypto = text.match(/bitcoin|btc|ethereum|eth|solana|sol|crypto|token|coin|megaeth|meme/);
      const hasPriceAction = text.match(/price|hit|reach|\$\d+[km]|above|below|all[- ]time high|ath|market cap|fdv|launch/);
      
      // Exclude non-crypto (GTA, sports, politics unless about crypto)
      const isNotCrypto = text.match(/gta|fifa|world cup|album|rihanna|playboi|deport|election/) && !text.match(/bitcoin|ethereum|solana/);
      
      return hasCrypto && hasPriceAction && !isNotCrypto;
    });
    
    console.log(`Found ${cryptoMarkets.length} crypto markets:\n`);
    
    for (const market of cryptoMarkets.slice(0, 10)) {
      console.log(`📊 ${market.question}`);
      console.log(`   ID: ${market.condition_id}`);
      console.log(`   Volume: $${(market.volume || 0).toLocaleString()}`);
      console.log(`   Liquidity: $${(market.liquidity || 0).toLocaleString()}`);
      console.log(`   End: ${new Date(market.end_date_iso).toLocaleDateString()}`);
      
      // Get current odds
      if (market.tokens && market.tokens.length > 0) {
        for (const token of market.tokens) {
          const price = (token.price || 0) * 100;
          console.log(`   → ${token.outcome}: ${price.toFixed(1)}%`);
        }
      }
      console.log('');
    }
    
    return cryptoMarkets;
    
  } catch (err) {
    console.error('Error scanning markets:', err.message);
    return [];
  }
}

async function getMarketDetails(conditionId) {
  try {
    const response = await fetch(`${POLYMARKET_API}/markets/${conditionId}`);
    const market = await response.json();
    return market;
  } catch (err) {
    console.error('Error fetching market:', err.message);
    return null;
  }
}

// Run scanner
const markets = await scanCryptoMarkets();

// Export for use in other scripts
export { scanCryptoMarkets, getMarketDetails };
