// Coinbase Public API - No auth needed, US-based, reliable

const COINBASE_API = 'https://api.coinbase.com/v2';

const COINBASE_IDS = {
  'BTC': 'BTC-USD',
  'ETH': 'ETH-USD',
  'SOL': 'SOL-USD',
  'XRP': 'XRP-USD'
};

async function getPrice(crypto) {
  const pair = COINBASE_IDS[crypto];
  if (!pair) {
    throw new Error(`Unsupported crypto: ${crypto}`);
  }
  
  try {
    const url = `${COINBASE_API}/prices/${pair}/spot`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }
    
    const data = await response.json();
    return parseFloat(data.data.amount);
    
  } catch (err) {
    console.error(`   ❌ Coinbase error for ${crypto}:`, err.message);
    throw err;
  }
}

async function getPrices(cryptos) {
  try {
    const promises = cryptos.map(crypto => getPrice(crypto));
    const prices = await Promise.all(promises);
    
    const result = {};
    cryptos.forEach((crypto, i) => {
      result[crypto] = prices[i];
    });
    
    return result;
  } catch (err) {
    throw err;
  }
}

// Test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing Coinbase API...\n');
  
  const prices = await getPrices(['BTC', 'ETH', 'SOL', 'XRP']);
  
  console.log('✅ Current Prices:');
  for (const [crypto, price] of Object.entries(prices)) {
    console.log(`  ${crypto}: $${price.toLocaleString()}`);
  }
}

export { getPrice, getPrices };
