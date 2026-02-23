// Scrape 5-minute markets from Polymarket website

async function get5MinMarkets() {
  try {
    const response = await fetch('https://polymarket.com/crypto/5M', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    
    // Extract dehydrated state (Next.js data)
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (!match) {
      console.log('Could not find Next.js data');
      return [];
    }
    
    const data = JSON.parse(match[1]);
    
    // Navigate to markets in the data structure
    const pageProps = data.props?.pageProps;
    
    if (!pageProps) {
      console.log('No pageProps found');
      return [];
    }
    
    // Try to find markets in dehydratedState
    const dehydrated = pageProps.dehydratedState;
    
    if (dehydrated && dehydrated.queries) {
      const markets = [];
      
      for (const query of dehydrated.queries) {
        if (query.state && query.state.data) {
          const queryData = query.state.data;
          
          // Check if it's a market object
          if (queryData.question && queryData.slug) {
            markets.push(queryData);
          }
          
          // Check if it's an array of markets
          if (Array.isArray(queryData)) {
            markets.push(...queryData.filter(m => m.question && m.slug));
          }
        }
      }
      
      // Filter for 5-minute markets
      const fiveMinMarkets = markets.filter(m => 
        m.slug.includes('updown-5m') || m.question.toLowerCase().includes('up or down')
      );
      
      return fiveMinMarkets;
    }
    
    return [];
    
  } catch (err) {
    console.error('Scrape error:', err.message);
    return [];
  }
}

const markets = await get5MinMarkets();

console.log(`\nFound ${markets.length} 5-minute markets:\n`);

for (const market of markets) {
  console.log(`📊 ${market.question}`);
  console.log(`   Slug: ${market.slug}`);
  console.log(`   End: ${new Date(market.endDate).toLocaleString()}`);
  console.log('');
}
