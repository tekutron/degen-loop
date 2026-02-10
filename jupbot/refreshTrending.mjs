#!/usr/bin/env node
/**
 * refreshTrending.mjs
 * Fetches fresh hot trending memes from DexScreener and updates trending_tokens_feb9.json
 * Run manually or via API to update the curated list
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
  console.log('🔥 Fetching fresh hot trending memes from DexScreener...');
  
  try {
    const boostsRes = await fetch(BOOSTS_URL, { cache: 'no-store' });
    if (!boostsRes.ok) throw new Error('DexScreener boosts API failed');
    
    const boosts = await boostsRes.json();
    const solTokens = boosts.filter((b) => 
      (b?.chainId ?? '').toLowerCase() === 'solana' && b?.tokenAddress
    );
    
    const candidates = [];
    
    for (const boost of solTokens.slice(0, 100)) {
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
        const liquidityUsd = Number(p?.liquidity?.usd ?? 0);
        const priceChange1h = Number(p?.priceChange?.h1 ?? 0);
        const priceChange24h = Number(p?.priceChange?.h24 ?? 0);
        
        // HIGH-SPEED SCALPING CRITERIA
        if (volumeH24 < 300000) continue; // $300K min (3x higher)
        if (liquidityUsd < 30000) continue; // $30K min (tradeable size)
        if (Math.abs(priceChange1h) < 1) continue; // Need ±1%+ 1h moves (active trading)
        
        let tier = '1';
        // Tier 2: Prime scalping targets (big moves + deep liquidity)
        if (
          Math.abs(priceChange1h) > 10 && // Big 1h swings
          liquidityUsd > 200000 && // Very deep liquidity
          volumeH1 > 100000 // Active right now
        ) {
          tier = '2';
        }
        
        candidates.push({
          tier,
          mint,
          symbol: p?.baseToken?.symbol || '???',
          name: p?.baseToken?.name || 'Unknown',
          priceUsd: Number(p.priceUsd ?? 0),
          dexUrl: p.url,
          volumeH1,
          volumeH24,
          liquidityUsd,
          priceChange1h,
          priceChange24h,
          movement: volumeH1 > 0 ? Math.round((volumeH24 / volumeH1) * 100) : 0,
        });
      } catch {}
    }
    
    if (candidates.length === 0) {
      console.log('⚠️  No qualifying tokens found');
      return null;
    }
    
    const tier2 = candidates.filter(t => t.tier === '2');
    const tier1 = candidates.filter(t => t.tier === '1');
    
    // Sort by 1h volatility (highest moves first - best for scalping)
    tier2.sort((a, b) => Math.abs(b.priceChange1h) - Math.abs(a.priceChange1h));
    tier1.sort((a, b) => Math.abs(b.priceChange1h) - Math.abs(a.priceChange1h));
    
    // Take top 10-12 most volatile tokens
    const result = [
      ...tier2.slice(0, 5), // Top 5 prime scalping targets
      ...tier1.slice(0, 7), // Top 7 high volatility
    ];
    
    console.log(`✅ Found ${result.length} tokens (${tier2.slice(0, 5).length} Prime Scalping, ${tier1.slice(0, 7).length} High Volatility)`);
    return result;
    
  } catch (err) {
    console.error('❌ Failed to fetch:', err.message);
    return null;
  }
}

async function main() {
  const newTokens = await fetchHotTrendingMemes();
  
  if (!newTokens || newTokens.length === 0) {
    console.log('❌ No new tokens to update');
    process.exit(1);
  }
  
  const data = {
    updatedAt: new Date().toISOString(),
    source: 'DexScreener Real-Time',
    strategy: '60% Tier 2 (Strong Activity + Good Liquidity) / 40% High Risk High Reward',
    trending: newTokens,
  };
  
  fs.writeFileSync(TRENDING_FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n✅ Updated ${TRENDING_FILE}`);
  console.log(`📊 Total tokens: ${newTokens.length}`);
  console.log(`\nTop 5:`);
  newTokens.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.symbol} (Tier ${t.tier}) - $${t.priceUsd.toFixed(6)} | Vol: $${(t.volumeH24 / 1000).toFixed(0)}K`);
  });
}

main().catch(console.error);
