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
  console.log('📊 Fetching RISKIER SCALPING targets (Early Snipes) from DexScreener...');
  
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
        
        // RISKIER SCALPING FILTERS (DexScreener "Early Snipes" tier)
        
        // 1. Market Cap: $50K - $10M (very riskier - allow smaller caps)
        if (fdv < 50000 || fdv > 10000000) continue;
        
        // 2. Liquidity: $8.5K+ (matches document "Riskier" tier exactly)
        if (liquidityUsd < 8500) continue;
        
        // 3. Pair Age: 0.5h - 72h (extended to catch more coins)
        if (ageHours < 0.5 || ageHours > 72) continue;
        
        // 4. 24h volume: Track but don't filter (fresh coins won't have 24h history)
        // Skip 24h volume filter for riskier tier
        
        // 5. 1h volume: $20K+ minimum (very loose for riskier)
        if (volumeH1 < 20000) continue;
        
        // 6. 5min volume: $3K+ minimum (immediate activity)
        if (volumeM5 < 3000) continue;
        
        // 7. CURRENT ACTIVITY: 1h volume should be >8% of 24h when applicable
        const volumeRatio = volumeH1 / (volumeH24 || volumeH1); // Fallback for fresh coins
        if (volumeRatio < 0.08 && volumeH24 > 0) continue;
        
        // 8. 1h momentum: +5%+ for riskier entry (catch earlier)
        if (priceChange1h < 5) continue; // Allow lower entry, but still positive
        
        // 9. Price volatility: Track but allow wide range (riskier tier)
        const volatility24h = Math.abs(priceChange24h);
        
        // 10. Transactions: 100+ in 24h (real activity, but less strict than 1h)
        if (txns24h < 100) continue;
        
        // Calculate scalping score (riskier tier - prioritize immediate momentum)
        const volumeM5Score = Math.min(volumeM5 / 1000, 30); // 5min volume (cap 30)
        const volumeH1Score = Math.min(volumeH1 / 10000, 30); // 1h volume (cap 30)
        const momentum1hScore = Math.min(priceChange1h, 60); // 1h momentum (cap 60)
        const freshnessScore = Math.max(0, 20 - ageHours); // Reward fresh coins (newer = higher)
        const scalpScore = volumeM5Score + volumeH1Score + momentum1hScore + freshnessScore;
        
        // Tier system: Hot early snipes vs Fresh movers
        let tier = '1'; // Fresh mover
        
        // Tier 2: Hot Early Snipe (fresh + strong momentum)
        if (
          fdv >= 200000 && fdv <= 800000 && // Sweet spot MC for riskier ($200K-$800K)
          liquidityUsd > 20000 && // Decent liquidity ($20K+)
          volumeM5 > 20000 && // Very active 5min ($20K+)
          volumeH1 > 100000 && // Strong 1h volume ($100K+)
          priceChange1h >= 20 && priceChange1h <= 100 && // Hot momentum (20-100%)
          ageHours < 12 // Fresh (under 12h)
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
    
    console.log(`✅ Found ${final.length} tokens (${tier2.length} Hot Early Snipes, ${tier1.length} Fresh Movers)`);
    
    const output = {
      updatedAt: new Date().toISOString(),
      source: 'DexScreener Riskier Scalping (Early Snipes)',
      strategy: 'MC: $100K-$1M | Liq: $10K+ | Age: 0.5-48h | Vol1h: $50K+ | Vol5m: $10K+ | 1h: +10-200% | Fresh launches with momentum',
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
