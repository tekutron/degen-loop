// CLOB API Client - Get real-time mid-prices from Polymarket orderbook
// Much faster than CoinGecko for 5-minute windows

const CLOB_API = 'https://clob.polymarket.com';

async function getMidPrice(tokenId) {
  try {
    const url = `${CLOB_API}/midpoint?token_id=${tokenId}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Returns mid-price (midpoint between bid/ask)
    return parseFloat(data.mid);
  } catch (err) {
    console.error(`Error fetching mid-price for ${tokenId}:`, err.message);
    return null;
  }
}

async function getOrderbook(tokenId, depth = 1) {
  try {
    const url = `${CLOB_API}/book?token_id=${tokenId}&side=BUY`;
    const buyResponse = await fetch(url);
    const buyData = await buyResponse.json();
    
    const sellUrl = `${CLOB_API}/book?token_id=${tokenId}&side=SELL`;
    const sellResponse = await fetch(sellUrl);
    const sellData = await sellResponse.json();
    
    return {
      bids: buyData.slice(0, depth),
      asks: sellData.slice(0, depth),
      bestBid: buyData[0]?.price || 0,
      bestAsk: sellData[0]?.price || 1,
      spread: (sellData[0]?.price || 1) - (buyData[0]?.price || 0)
    };
  } catch (err) {
    console.error(`Error fetching orderbook for ${tokenId}:`, err.message);
    return null;
  }
}

// Track price history for momentum calculation
const priceHistory = new Map();

function trackPrice(tokenId, price) {
  if (!priceHistory.has(tokenId)) {
    priceHistory.set(tokenId, []);
  }
  
  const history = priceHistory.get(tokenId);
  history.push({ price, timestamp: Date.now() });
  
  // Keep last 10 minutes of data
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
  const filtered = history.filter(p => p.timestamp > tenMinutesAgo);
  priceHistory.set(tokenId, filtered);
}

function calculate5MinMomentum(tokenId) {
  const history = priceHistory.get(tokenId);
  if (!history || history.length < 2) {
    return { change: 0, trend: 'UNKNOWN' };
  }
  
  // Get price from 5 minutes ago
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  const oldPrice = history.find(p => p.timestamp <= fiveMinutesAgo);
  const currentPrice = history[history.length - 1];
  
  if (!oldPrice) {
    return { change: 0, trend: 'UNKNOWN' };
  }
  
  const change = ((currentPrice.price - oldPrice.price) / oldPrice.price) * 100;
  
  let trend = 'NEUTRAL';
  if (change > 5) trend = 'STRONG_UP';
  else if (change > 2) trend = 'UP';
  else if (change < -5) trend = 'STRONG_DOWN';
  else if (change < -2) trend = 'DOWN';
  
  return { change, trend, currentPrice: currentPrice.price };
}

export { getMidPrice, getOrderbook, trackPrice, calculate5MinMomentum };
