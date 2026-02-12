#!/usr/bin/env node
/**
 * refreshTrending.mjs - SCALPING OPTIMIZED MODE
 * Fetches active micro-scalp candidates from DexScreener
 * Focus: 0.5-6h coins with high liquidity + live volume + tight spreads
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
  console.log('📊 Fetching SCALPING OPTIMIZED targets from DexScreener...');
  
  try {
    const boostsRes = await fetch(BOOSTS_URL, { cache: 'no-store' });
    if (!boostsRes.ok) throw new Error('DexScreener boosts API failed');
    
    const boosts = await boostsRes.json();
    console.log(`   Found ${boosts.length} total boosts from API`);
    const solTokens = boosts.filter((b) => 
      (b?.chainId ?? '').toLowerCase() === 'solana' && b?.tokenAddress
    );
    console.log(`   ${solTokens.length} Solana tokens after chain filter`);
    
    const candidates = [];
    const now = Date.now();
    let debugCounts = { total: 0, noSolPairs: 0, stablecoin: 0, mcFail: 0, liqFail: 0, ageFail: 0, vol1hFail: 0, vol5mFail: 0, megaPumpFail: 0, txnFail: 0, passed: 0 };
    
    for (const boost of solTokens.slice(0, 300)) {
      debugCounts.total++;
      try {
        const res = await fetch(TOKEN_URL(boost.tokenAddress), { cache: 'no-store' });
        if (!res.ok) continue;
        
        const json = await res.json();
        const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
        
        const solPairs = pairs.filter((p) => (p?.chainId ?? '').toLowerCase() === 'solana');
        if (solPairs.length === 0) { debugCounts.noSolPairs++; continue; }
        
        solPairs.sort((a, b) => Number(b?.volume?.h24 ?? 0) - Number(a?.volume?.h24 ?? 0));
        const p = solPairs[0];
        
        const mint = p?.baseToken?.address;
        if (!mint || STABLECOINS.has(mint)) { debugCounts.stablecoin++; continue; }
        
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
        
        // SCALPING OPTIMIZED FILTERS (Quality over quantity)
        
        // 1. Market Cap: $50K - $10M (wider range, still focused)
        if (fdv < 50000 || fdv > 10000000) { debugCounts.mcFail++; continue; }
        
        // 2. Liquidity: $15K+ (better depth for quick in/out)
        if (liquidityUsd < 15000) { debugCounts.liqFail++; continue; }
        
        // 3. Pair Age: 30min - 12h (active window, not brand new)
        if (ageHours < 0.5 || ageHours > 12) { debugCounts.ageFail++; continue; }
        
        // 4. 1h volume: $20K+ minimum (real action)
        if (volumeH1 < 20000) { debugCounts.vol1hFail++; continue; }
        
        // 5. 5min volume: $1K+ minimum (active trading)
        if (volumeM5 < 1000) { debugCounts.vol5mFail++; continue; }
        
        // 6. Reject mega-pumps (>500% 1h = trap, already late)
        if (h1 > 500) { debugCounts.megaPumpFail++; continue; }
        
        // 7. Price volatility: Track for scoring
        const volatility24h = Math.abs(priceChange24h);
        
        // 8. Transactions: 10+ in 24h (minimal activity check)
        if (txns24h < 10) { debugCounts.txnFail++; continue; }
        
        // Calculate volume ratio (5min vs 1h average)
        const volumeRatio = volumeH1 > 0 ? (volumeM5 / (volumeH1 / 12)) : 0;
        
        debugCounts.passed++;
        
        // Calculate micro scalp score (5min activity + liquidity)
        const volumeM5Score = Math.min(volumeM5 / 1000, 50); // 5min volume (cap 50) - PRIORITY
        const liquidityScore = Math.min(liquidityUsd / 10000, 30); // Liquidity (cap 30)
        const momentum5mScore = Math.min(priceChangeM5 * 5, 40); // 5min momentum (5x weight, cap 40)
        const txnScore = Math.min(txns5m / 10, 30); // 5min txns (cap 30)
        const scalpScore = volumeM5Score + liquidityScore + momentum5mScore + txnScore;
        
        // Tier system: Prime scalp vs Active scalp
        let tier = '1'; // Active scalp
        
        // Tier 2: Prime target (better conditions)
        if (
          fdv >= 500000 && fdv <= 5000000 && // Sweet spot MC ($500K-$5M)
          liquidityUsd > 20000 && // Better liquidity ($20K+)
          volumeM5 > 10000 && // Very active 5min ($10K+)
          volumeH1 > 50000 && // Strong 1h volume ($50K+)
          txns5m > 20 // Good activity (20+ txns in 5min)
        ) {
          tier = '2';
        }
        
        try {
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
        } catch (pushErr) {
          console.log(`   Error pushing candidate ${p?.baseToken?.symbol}: ${pushErr.message}`);
        }
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
    
    console.log(`✅ Found ${final.length} tokens (${tier2.length} Prime Targets, ${tier1.length} Standard Targets)`);
    console.log(`\n📊 Filter Debug:`);
    console.log(`   Total checked: ${debugCounts.total}`);
    console.log(`   No Solana pairs: ${debugCounts.noSolPairs}`);
    console.log(`   Stablecoin: ${debugCounts.stablecoin}`);
    console.log(`   Market cap fail: ${debugCounts.mcFail}`);
    console.log(`   Liquidity fail: ${debugCounts.liqFail}`);
    console.log(`   Age fail: ${debugCounts.ageFail}`);
    console.log(`   1h volume fail: ${debugCounts.vol1hFail}`);
    console.log(`   5min volume fail: ${debugCounts.vol5mFail}`);
    console.log(`   Mega-pump fail (>500% 1h): ${debugCounts.megaPumpFail}`);
    console.log(`   Transactions fail: ${debugCounts.txnFail}`);
    console.log(`   ✅ Passed all filters: ${debugCounts.passed}`);
    
    const output = {
      updatedAt: new Date().toISOString(),
      source: 'DexScreener Scalping Optimized',
      strategy: 'MC: $50K-$10M | Liq: $15K+ | Age: 0.5h-12h | Vol1h: $20K+ | Vol5m: $1K+ | Scalping optimized',
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
