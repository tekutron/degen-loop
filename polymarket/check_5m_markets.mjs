// Check for 5M crypto markets on Polymarket

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

async function find5MMarkets() {
  console.log('🔍 Searching for /crypto/5M markets...\n');
  
  // Try different API endpoints
  const endpoints = [
    `${POLYMARKET_API}/markets?closed=false&limit=500`,
    `${POLYMARKET_API}/markets?tag=crypto`,
    `${POLYMARKET_API}/markets?tag=5M`,
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Checking: ${endpoint}`);
      const response = await fetch(endpoint);
      const markets = await response.json();
      
      // Look for 5M in slug or question
      const fiveMin = markets.filter(m => {
        const slug = m.slug || '';
        const question = m.question || '';
        const cat = m.category || '';
        
        return slug.includes('5m') || 
               slug.includes('5-minute') || 
               question.toLowerCase().includes('5 min') ||
               question.toLowerCase().includes('5-min') ||
               cat.toLowerCase().includes('5m');
      });
      
      if (fiveMin.length > 0) {
        console.log(`\n✅ Found ${fiveMin.length} markets!\n`);
        for (const m of fiveMin.slice(0, 10)) {
          console.log(`📊 ${m.question}`);
          console.log(`   Slug: ${m.slug}`);
          console.log(`   Volume: $${(m.volume || 0).toLocaleString()}`);
          console.log('');
        }
      }
      
    } catch (err) {
      console.log(`   Error: ${err.message}`);
    }
  }
  
  // Also try searching by tags/events
  console.log('\n🔍 Checking events...\n');
  try {
    const response = await fetch(`${POLYMARKET_API}/events`);
    const events = await response.json();
    
    const cryptoEvents = events.filter(e => {
      const title = e.title || '';
      const slug = e.slug || '';
      return title.toLowerCase().includes('5m') || 
             title.toLowerCase().includes('5 min') ||
             slug.includes('5m');
    });
    
    console.log(`Found ${cryptoEvents.length} 5M events`);
    for (const e of cryptoEvents.slice(0, 5)) {
      console.log(`  - ${e.title} (${e.slug})`);
    }
    
  } catch (err) {
    console.log(`Events error: ${err.message}`);
  }
  
  // Check if there's a specific category
  console.log('\n🔍 Checking for crypto/5M category...\n');
  try {
    // Some APIs use different structures
    const slugResponse = await fetch(`${POLYMARKET_API}/markets?slug=crypto-5m`);
    const slugData = await slugResponse.json();
    console.log('Slug search result:', slugData);
  } catch (err) {
    console.log(`Slug search error: ${err.message}`);
  }
}

find5MMarkets();
