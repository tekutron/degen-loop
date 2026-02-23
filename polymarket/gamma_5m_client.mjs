// Gamma API Client for 5-Minute Markets
// Adapted from discountry/polymarket-trading-bot

const GAMMA_API = 'https://gamma-api.polymarket.com';

const COIN_SLUGS = {
  'BTC': 'btc-updown-5m',
  'ETH': 'eth-updown-5m',
  'SOL': 'sol-updown-5m',
  'XRP': 'xrp-updown-5m'
};

async function getMarketBySlug(slug) {
  try {
    const url = `${GAMMA_API}/markets/slug/${slug}`;
    const response = await fetch(url);
    
    if (response.status === 200) {
      return await response.json();
    }
    return null;
  } catch (err) {
    console.error(`Error fetching ${slug}:`, err.message);
    return null;
  }
}

async function getCurrent5MinMarket(coin) {
  const prefix = COIN_SLUGS[coin];
  if (!prefix) {
    throw new Error(`Unsupported coin: ${coin}`);
  }
  
  // Calculate current 5-minute window
  const now = new Date();
  const minute = Math.floor(now.getMinutes() / 5) * 5;
  const currentWindow = new Date(now);
  currentWindow.setMinutes(minute, 0, 0);
  
  const currentTs = Math.floor(currentWindow.getTime() / 1000);
  
  // Try current window
  let slug = `${prefix}-${currentTs}`;
  let market = await getMarketBySlug(slug);
  
  if (market && market.acceptingOrders) {
    console.log(`✅ Found current 5m market: ${slug}`);
    return market;
  }
  
  // Try next window (in case current just ended)
  const nextTs = currentTs + 300; // 5 minutes
  slug = `${prefix}-${nextTs}`;
  market = await getMarketBySlug(slug);
  
  if (market && market.acceptingOrders) {
    console.log(`✅ Found next 5m market: ${slug}`);
    return market;
  }
  
  // Try previous window (might still be active)
  const prevTs = currentTs - 300;
  slug = `${prefix}-${prevTs}`;
  market = await getMarketBySlug(slug);
  
  if (market && market.acceptingOrders) {
    console.log(`✅ Found previous 5m market: ${slug}`);
    return market;
  }
  
  return null;
}

async function get5MinMarketsForAllCoins() {
  const markets = [];
  
  for (const coin of ['BTC', 'ETH', 'SOL', 'XRP']) {
    const market = await getCurrent5MinMarket(coin);
    if (market) {
      markets.push({ coin, market });
    }
  }
  
  return markets;
}

export { getCurrent5MinMarket, get5MinMarketsForAllCoins, getMarketBySlug };
