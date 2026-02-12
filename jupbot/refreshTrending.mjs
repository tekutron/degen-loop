#!/usr/bin/env node
/**
 * refreshTrending.mjs - SWING TRADING MODE
 * Fetches established trending memes from DexScreener
 * Focus: 6-48h coins with strong volume + sustained momentum
 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TRENDING_FILE = path.join(HERE, 'trending_tokens_feb9.json');
const BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/latest/v1';
const TOKEN_URL = (addr) => `https://api.dexscreener.com/latest/dex/tokens/${addr}`;

const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',   // USD1
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',   // USDH
]);

async function fetchHotTrendingMemes() {
  console.log('📊 Fetching MICRO SCALPING targets (5min activity focus) from DexScreener...');
  
  try {
    const boostsRes = await fetch(BOOSTS_URL, { cache: 'no-store' });
    if (!boostsRes.ok) throw new Error('DexScreener boosts API failed');
    
    const boosts = await boostsRes.json();
    const solTokens = boosts.filter((b) => 
      (b?.chainId ?? '').toLowerCase() === 'solana' && b?.tokenAddress
    );
    
    const candidates = [];
    const now = Date.now();
    
    for (const boost of solTokens.slice(0, 300)) {
      try {
        const res = await fetch(TOKEN_URL(boost.tokenAddress), { cache: 'no-store' });
        if (!res.ok) continue;
        
        const json = await res.json();
        const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
        
        const solPairs = pairs.filter((p) => (p?.chainId ?? '').toLowerCase() === 'solana');
        if (solPairs.length === 0) continue;
        
        solPairs.sort((a, b) => Number(b?.volume?.h24 ?? 0) - Number(a?.volume?.h24 ?? 0));
        const p = solPairs[0];
        
        const mint = p?.baseToken?.address;
        if (!mint || STABLECOINS.has(mint)) continue;
        
        const volumeH1 = Number(p?.volume?.h1 ?? 0);
        const volumeH24 = Number(p?.volume?.h24 ?? 0);
        const volumeM5 = Number(p?.volume?.m5 ?? 0);
        const liquidityUsd = Number(p?.liquidity?.usd ?? 0);
        const fdv = Number(p?.fdv ?? 0);
        const priceChange1h = Number(p?.priceChange?.h1 ?? 0);
        const priceChange6h = Number(p?.priceChange?.h6 ?? 0);
        const priceChange24h = Number(p?.priceChange?.h24 ?? 0);
        const priceChangeM5 = Number(p?.priceChange?.m5 ?? 0);
        const txns5m = Number(p?.txns?.m5?.buys ?? 0) + Number(p?.txns?.m5?.sells ?? 0);
        const txns24h = Number(p?.txns?.h24?.buys ?? 0) + Number(p?.txns?.h24?.sells ?? 0);
        const buys24h = Number(p?.txns?.h24?.buys ?? 0);
        
        // Parse pair age (pairCreatedAt is unix timestamp in ms)
        const pairAge = p?.pairCreatedAt ? now - p.pairCreatedAt : 999999999;
        const ageHours = pairAge / (1000 * 60 * 60);
        
        // MICRO SCALPING FILTERS (High volume + liquidity for quick flips)
        
        // 1. Market Cap: $100K - $20M (focus on liquid coins)
        if (fdv < 100000 || fdv > 20000000) continue;
        
        // 2. Liquidity: $15K+ (loosened for more candidates)
        if (liquidityUsd < 15000) continue;
        
        // 3. Pair Age: 0.5h - 120h (allow established + fresh)
        if (ageHours < 0.5 || ageHours > 120) continue;
        
        // 4. 24h volume: $100K+ (loosened for more candidates)
        if (volumeH24 < 100000) continue;
        
        // 5. 5min volume: $5K+ minimum (MUST be active RIGHT NOW)
        if (volumeM5 < 5000) continue;
        
        // 6. 1h volume: $30K+ minimum (sustained activity)
        if (volumeH1 < 30000) continue;
        
        // 7. 5min momentum: ANY positive movement (even +0.1%)
        if (priceChangeM5 < 0.1) continue; // Must be moving up in 5min (or flat)
        
        // 8. Price volatility: Track but allow wide range
        const volatility24h = Math.abs(priceChange24h);
        
        // 9. Transactions: 100+ in 24h (real activity)
        if (txns24h < 100) continue;
        
        // 10. 5min transactions: Track for spread analysis
        
        // Calculate micro scalp score (5min activity + liquidity)
        const volumeM5Score = Math.min(volumeM5 / 1000, 50); // 5min volume (cap 50) - PRIORITY
        const liquidityScore = Math.min(liquidityUsd / 10000, 30); // Liquidity (cap 30)
        const momentum5mScore = Math.min(priceChangeM5 * 5, 40); // 5min momentum (5x weight, cap 40)
        const txnScore = Math.min(txns5m / 10, 30); // 5min txns (cap 30)
        const scalpScore = volumeM5Score + liquidityScore + momentum5mScore + txnScore;
        
        // Tier system: Prime scalp vs Active scalp
        let tier = '1'; // Active scalp
        
        // Tier 2: Prime Micro Scalp (perfect conditions)
        if (
          fdv >= 500000 && fdv <= 5000000 && // Sweet spot MC ($500K-$5M)
          liquidityUsd > 50000 && // High liquidity ($50K+)
          volumeM5 > 20000 && // Very active 5min ($20K+)
          volumeH1 > 100000 && // Strong 1h volume ($100K+)
          priceChangeM5 >= 1 && priceChangeM5 <= 10 && // Good 5min momentum (1-10%)
          txns5m > 50 // Tight spread (50+ txns in 5min)
        ) {
          tier = '2';
        }
        
        candidates.push({
          tier,
          mint,
          symbol: p?.baseToken?.symbol || '???',
          name: p?.baseToken?.name || 'Unknown',
          priceUsd: Number(p.priceUsd ?? 0),
          dexUrl: p?.url || `https://dexscreener.com/solana/${mint}`,
          volumeH1,
          volumeH24,
          volumeM5,
          liquidityUsd,
          fdv,
          priceChange1h,
          priceChange6h,
          priceChange24h,
          priceChangeM5,
          txns5m,
          txns24h,
          buys24h,
          ageHours: Math.round(ageHours * 10) / 10,
          volumeRatio: Math.round(volumeRatio * 1000) / 10, // Percentage
          volatility24h: Math.round(volatility24h * 10) / 10,
          scalpScore: Math.round(scalpScore),
        });
      } catch (err) {
        // Skip invalid tokens
      }
    }
    
    // Sort by scalping score (DexScreener pro methodology)
    candidates.sort((a, b) => b.scalpScore - a.scalpScore);
    
    // Separate tiers
    const tier2 = candidates.filter((c) => c.tier === '2');
    const tier1 = candidates.filter((c) => c.tier === '1');
    
    // Target: 5 Elite + 10 Good = 15 tokens (focused selection)
    const final = [...tier2.slice(0, 5), ...tier1.slice(0, 10)];
    
    console.log(`✅ Found ${final.length} tokens (${tier2.length} Prime Micro Scalps, ${tier1.length} Active Scalps)`);
    
    const output = {
      updatedAt: new Date().toISOString(),
      source: 'DexScreener Micro Scalping (5min Activity)',
      strategy: 'MC: $100K-$20M | Liq: $30K+ | Vol24h: $200K+ | Vol1h: $50K+ | Vol5m: $10K+ | 5min: +0.5%+ | High liquidity for quick 1-3% flips',
      trending: final,
    };
    
    fs.writeFileSync(TRENDING_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log('\n✅ Updated', TRENDING_FILE);
    console.log('📊 Total tokens:', final.length);
    console.log('\nTop 5:');
    final.slice(0, 5).forEach((t, i) => {
      const tier = t.tier === '2' ? 'Prime' : 'Good';
      console.log(`  ${i + 1}. ${t.symbol} (${tier}) - $${t.priceUsd} | Age: ${t.ageHours}h | 24h: ${t.volatility24h}% | 1h: ${t.priceChange1h.toFixed(1)}% | Vol: $${Math.round(t.volumeH24 / 1000)}K`);
    });
    
    return final;
  } catch (err) {
    console.error('❌ Failed to fetch trending:', err.message);
    return [];
  }
}

fetchHotTrendingMemes().catch((err) => {
  console.error(err);
  process.exit(1);
});
