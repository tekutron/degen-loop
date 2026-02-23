// Enhanced Predictor with Real Data Sources
// Adds CoinGecko price API + better analysis

import CryptoPredictionEngine from './predictor.mjs';

class EnhancedPredictor extends CryptoPredictionEngine {
  
  async fetchPriceData(ticker) {
    // Use real CoinGecko API
    try {
      const coinIds = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana'
      };
      
      const coinId = coinIds[ticker];
      if (!coinId) {
        return { change_1h: 0, change_24h: 0, change_7d: 0 };
      }
      
      // CoinGecko free API
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.market_data) {
        return {
          change_1h: data.market_data.price_change_percentage_1h_in_currency?.usd || 0,
          change_24h: data.market_data.price_change_percentage_24h || 0,
          change_7d: data.market_data.price_change_percentage_7d || 0,
          current_price: data.market_data.current_price.usd
        };
      }
      
      return { change_1h: 0, change_24h: 0, change_7d: 0 };
      
    } catch (err) {
      console.log(`   ⚠️  CoinGecko API error: ${err.message}`);
      // Fallback to mock data
      return super.fetchPriceData(ticker);
    }
  }
  
  async analyzePriceAction(market) {
    const question = market.question.toLowerCase();
    let ticker = null;
    
    // Extract ticker
    if (question.includes('bitcoin') || question.includes('btc')) {
      ticker = 'BTC';
    } else if (question.includes('ethereum') || question.includes('eth')) {
      ticker = 'ETH';
    } else if (question.includes('solana') || question.includes('sol')) {
      ticker = 'SOL';
    }
    
    if (!ticker) {
      return { score: 5, signal: 'NEUTRAL', reason: 'No specific crypto identified' };
    }
    
    try {
      console.log(`   📈 Fetching ${ticker} price data...`);
      const priceData = await this.fetchPriceData(ticker);
      
      const momentum1h = priceData.change_1h || 0;
      const momentum24h = priceData.change_24h || 0;
      const momentum7d = priceData.change_7d || 0;
      
      // Advanced scoring
      let score = 5;
      let signal = 'NEUTRAL';
      
      // Strong bullish: sustained uptrend
      if (momentum24h > 8 && momentum7d > 15) {
        score = 9;
        signal = 'VERY_BULLISH';
      } else if (momentum24h > 5 && momentum7d > 10) {
        score = 8;
        signal = 'BULLISH';
      } else if (momentum24h > 2 && momentum7d > 5) {
        score = 6.5;
        signal = 'SLIGHTLY_BULLISH';
      } 
      // Strong bearish: sustained downtrend
      else if (momentum24h < -8 && momentum7d < -15) {
        score = 1;
        signal = 'VERY_BEARISH';
      } else if (momentum24h < -5 && momentum7d < -10) {
        score = 2;
        signal = 'BEARISH';
      } else if (momentum24h < -2 && momentum7d < -5) {
        score = 3.5;
        signal = 'SLIGHTLY_BEARISH';
      }
      
      const reason = `${ticker} 1h: ${momentum1h > 0 ? '+' : ''}${momentum1h.toFixed(1)}%, 24h: ${momentum24h > 0 ? '+' : ''}${momentum24h.toFixed(1)}%, 7d: ${momentum7d > 0 ? '+' : ''}${momentum7d.toFixed(1)}%`;
      
      if (priceData.current_price) {
        console.log(`   Current: $${priceData.current_price.toLocaleString()}`);
      }
      
      return { score, signal, reason };
      
    } catch (err) {
      console.log(`   ⚠️  Price analysis error: ${err.message}`);
      return { score: 5, signal: 'NEUTRAL', reason: 'Price data unavailable' };
    }
  }
}

export default EnhancedPredictor;
