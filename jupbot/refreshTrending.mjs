#!/usr/bin/env node
/**
 * refreshTrending.mjs - AGGRESSIVE SCALPING MODE
 * Fetches fresh hot trending memes from DexScreener with tight filters
 * Based on professional scalping parameters for 5-20% quick flips
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
  console.log('📊 Fetching RANGE TRADING targets from DexScreener...');
  
  try {
    const boostsRes = await fetch(BOOSTS_URL, { cache: 'no-store' });
    if (!boostsRes.ok) throw new Error('DexScreener boosts API failed');
    
    const boosts = await boostsRes.json();
    const solTokens = boosts.filter((b) => 
      (b?.chainId ?? '').toLowerCase() === 'solana' && b?.tokenAddress
    );
    
    const candidates = [];
    const now = Date.now();
    
    for (const boost of solTokens.slice(0, 150)) {
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
        
        // RANGE TRADING FILTERS (stable oscillating coins)
        
        // 1. Market Cap: $30K - $10M (broader range)
        if (fdv < 30000 || fdv > 10000000) continue;
        
        // 2. Liquidity: $15K+ (enough for our trades)
        if (liquidityUsd < 15000) continue;
        
        // 3. Pair Age: 3 - 72 hours (established trending, loosened)
        if (ageHours < 3 || ageHours > 72) continue;
        
        // 4. 24h volume: $100K+ (consistent interest, loosened)
        if (volumeH24 < 100000) continue;
        
        // 5. Volume consistency: 1h volume should be >5% of 24h (still active)
        const volumeRatio = volumeH1 / volumeH24;
        if (volumeRatio < 0.05) continue;
        
        // 6. Price volatility: 10-50% in 24h (oscillates nicely)
        const volatility24h = Math.abs(priceChange24h);
        if (volatility24h < 10 || volatility24h > 50) continue;
        
        // 7. Not in extreme pump/dump: 1h change -20% to +20%
        if (priceChange1h < -20 || priceChange1h > 20) continue;
        
        // 8. Transactions: 100+ in 24h (real activity)
        if (txns24h < 100) continue;
        
        // Calculate range trading score (volume consistency + moderate volatility)
        const volumeScore = volumeRatio * 100; // Higher is better
        const volatilityScore = 50 - Math.abs(volatility24h - 25); // Closer to 25% is ideal
        const rangeScore = volumeScore + volatilityScore;
        
        // Tier system: Prime range traders vs. Good candidates
        let tier = '1'; // Good range trader
        
        // Tier 2: Prime Range Trading (optimal oscillation)
        if (
          fdv >= 100000 && fdv <= 1000000 && // Sweet spot MC
          liquidityUsd > 50000 && // Deep liquidity for tight spreads
          volumeH24 > 500000 && // Very consistent volume
          volumeRatio > 0.08 && // Strong hourly activity
          volatility24h > 15 && volatility24h < 35 && // Perfect oscillation range
          Math.abs(priceChange1h) < 10 // Currently stable (not pumping/dumping)
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
          rangeScore: Math.round(rangeScore),
        });
      } catch (err) {
        // Skip invalid tokens
      }
    }
    
    // Sort by range trading score (volume consistency + volatility)
    candidates.sort((a, b) => b.rangeScore - a.rangeScore);
    
    // Separate tiers
    const tier2 = candidates.filter((c) => c.tier === '2');
    const tier1 = candidates.filter((c) => c.tier === '1');
    
    // Target: 5 Tier 2 + 10 Tier 1 = 15 tokens
    const final = [...tier2.slice(0, 5), ...tier1.slice(0, 10)];
    
    console.log(`✅ Found ${final.length} tokens (${tier2.length} Prime Range Traders, ${tier1.length} Good Range Traders)`);
    
    const output = {
      updatedAt: new Date().toISOString(),
      source: 'DexScreener Range Trading',
      strategy: 'MC: $50K-$5M | Liq: $20K+ | Age: 6-48h | Vol24h: $200K+ | Vol consistency | 10-50% volatility | Stable 1h',
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
