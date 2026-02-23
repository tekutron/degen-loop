// Binance Price API - Fast, no rate limits, real-time prices
// Better alternative to CoinGecko

const BINANCE_API = 'https://api.binance.com/api/v3';

// Map our crypto symbols to Binance trading pairs
const BINANCE_SYMBOLS = {
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'SOL': 'SOLUSDT',
  'XRP': 'XRPUSDT'
};

async function getPrice(crypto) {
  const symbol = BINANCE_SYMBOLS[crypto];
  if (!symbol) {
    throw new Error(`Unsupported crypto: ${crypto}`);
  }
  
  try {
    const url = `${BINANCE_API}/ticker/price?symbol=${symbol}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    return parseFloat(data.price);
    
  } catch (err) {
    console.error(`   ❌ Binance error for ${crypto}:`, err.message);
    throw err;
  }
}

// Get prices for multiple cryptos at once (more efficient)
async function getPrices(cryptos) {
  const symbols = cryptos.map(c => BINANCE_SYMBOLS[c]).join(',');
  
  try {
    // Binance supports batch queries
    const promises = cryptos.map(crypto => getPrice(crypto));
    const prices = await Promise.all(promises);
    
    const result = {};
    cryptos.forEach((crypto, i) => {
      result[crypto] = prices[i];
    });
    
    return result;
    
  } catch (err) {
    console.error('Batch price fetch error:', err.message);
    throw err;
  }
}

// Test the API
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing Binance API...\n');
  
  const prices = await getPrices(['BTC', 'ETH', 'SOL', 'XRP']);
  
  console.log('Current Prices:');
  for (const [crypto, price] of Object.entries(prices)) {
    console.log(`  ${crypto}: $${price.toLocaleString()}`);
  }
}

export { getPrice, getPrices };
