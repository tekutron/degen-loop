// Scrape live 5-minute markets from Polymarket page

async function scrapeLiveMarkets() {
  try {
    const response = await fetch('https://polymarket.com/crypto/5M');
    const html = await response.text();
    
    // Extract Next.js data
    const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    
    if (!dataMatch) {
      console.log('Could not find page data');
      return [];
    }
    
    const pageData = JSON.parse(dataMatch[1]);
    
    // Navigate through the data structure
    const props = pageData.props?.pageProps;
    
    if (!props) {
      console.log('No pageProps found');
      return [];
    }
    
    // Look for markets in dehydratedState
    const markets = [];
    
    if (props.dehydratedState?.queries) {
      for (const query of props.dehydratedState.queries) {
        if (query.state?.data) {
          const data = query.state.data;
          
          // Single market
          if (data.question && data.slug) {
            markets.push(data);
          }
          
          // Array of markets
          if (Array.isArray(data)) {
            markets.push(...data.filter(m => m.question && m.slug));
          }
          
          // Nested in pages/data
          if (data.pages) {
            for (const page of data.pages) {
              if (Array.isArray(page)) {
                markets.push(...page.filter(m => m.question && m.slug));
              }
              if (page.data && Array.isArray(page.data)) {
                markets.push(...page.data.filter(m => m.question && m.slug));
              }
            }
          }
        }
      }
    }
    
    // Filter for active 5-minute markets
    const activeMarkets = markets.filter(m => {
      const is5min = m.slug && (m.slug.includes('updown-5m') || m.slug.includes('up-or-down-5m'));
      const notClosed = !m.closed;
      const inFuture = m.endDate && new Date(m.endDate) > new Date();
      return is5min && notClosed && inFuture;
    });
    
    return activeMarkets;
    
  } catch (err) {
    console.error('Scrape error:', err.message);
    return [];
  }
}

const markets = await scrapeLiveMarkets();

console.log(`\n✅ Found ${markets.length} LIVE 5-minute markets:\n`);

for (const market of markets) {
  console.log(`📊 ${market.question}`);
  console.log(`   Slug: ${market.slug}`);
  console.log(`   End: ${new Date(market.endDate).toLocaleString()}`);
  console.log(`   Closed: ${market.closed}`);
  console.log('');
}

export { scrapeLiveMarkets };
