#!/usr/bin/env node
/**
 * diagnose-filters.mjs - Debug why no tokens pass filters
 */

import fs from 'node:fs';
import path from 'node:path';

const BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/latest/v1';
const TOKEN_URL = (addr) => `https://api.dexscreener.com/latest/dex/tokens/${addr}`;

const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',   // USD1
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',   // USDH
]);

async function diagnose() {
  console.log('🔍 Diagnosing filter rejections...\n');
  
  const boostsRes = await fetch(BOOSTS_URL, { cache: 'no-store' });
  if (!boostsRes.ok) throw new Error('DexScreener boosts API failed');
  
  const boosts = await boostsRes.json();
  const solTokens = boosts.filter((b) => 
    (b?.chainId ?? '').toLowerCase() === 'solana' && b?.tokenAddress
  );
  
  console.log(`📊 Found ${solTokens.length} Solana tokens from boosts API\n`);
  
  const filterStats = {
    total: 0,
    noPairs: 0,
    stablecoin: 0,
    marketCap: 0,
    liquidity: 0,
    pairAge: 0,
    volume24h: 0,
    volumeRatio: 0,
    volatility: 0,
    priceChange1h: 0,
    transactions: 0,
    passed: 0,
  };
  
  const now = Date.now();
  const samples = [];
  
  for (const boost of solTokens.slice(0, 50)) {
    try {
      const res = await fetch(TOKEN_URL(boost.tokenAddress), { cache: 'no-store' });
      if (!res.ok) continue;
      
      const json = await res.json();
      const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
      
      filterStats.total++;
      
      const solPairs = pairs.filter((p) => (p?.chainId ?? '').toLowerCase() === 'solana');
      if (solPairs.length === 0) {
        filterStats.noPairs++;
        continue;
      }
      
      solPairs.sort((a, b) => Number(b?.volume?.h24 ?? 0) - Number(a?.volume?.h24 ?? 0));
      const p = solPairs[0];
      
      const mint = p?.baseToken?.address;
      if (!mint || STABLECOINS.has(mint)) {
        filterStats.stablecoin++;
        continue;
      }
      
      const volumeH1 = Number(p?.volume?.h1 ?? 0);
      const volumeH24 = Number(p?.volume?.h24 ?? 0);
      const liquidityUsd = Number(p?.liquidity?.usd ?? 0);
      const fdv = Number(p?.fdv ?? 0);
      const priceChange1h = Number(p?.priceChange?.h1 ?? 0);
      const priceChange24h = Number(p?.priceChange?.h24 ?? 0);
      const txns24h = Number(p?.txns?.h24?.buys ?? 0) + Number(p?.txns?.h24?.sells ?? 0);
      
      const pairAge = p?.pairCreatedAt ? now - p.pairCreatedAt : 999999999;
      const ageHours = pairAge / (1000 * 60 * 60);
      const volumeRatio = volumeH1 / volumeH24;
      const volatility24h = Math.abs(priceChange24h);
      
      let rejected = null;
      
      // Market Cap filter
      if (fdv < 10000 || fdv > 10000000) {
        filterStats.marketCap++;
        rejected = `MC $${Math.round(fdv)}`;
      }
      // Liquidity filter
      else if (liquidityUsd < 15000) {
        filterStats.liquidity++;
        rejected = `Liq $${Math.round(liquidityUsd)}`;
      }
      // Age filter
      else if (ageHours < 1 || ageHours > 120) {
        filterStats.pairAge++;
        rejected = `Age ${ageHours.toFixed(1)}h`;
      }
      // Volume filter
      else if (volumeH24 < 100000) {
        filterStats.volume24h++;
        rejected = `Vol24h $${Math.round(volumeH24)}`;
      }
      // Volume consistency
      else if (volumeRatio < 0.05) {
        filterStats.volumeRatio++;
        rejected = `VolRatio ${(volumeRatio * 100).toFixed(1)}%`;
      }
      // Volatility
      else if (volatility24h < 10 || volatility24h > 50) {
        filterStats.volatility++;
        rejected = `Volatility ${volatility24h.toFixed(1)}%`;
      }
      // 1h change
      else if (priceChange1h < -20 || priceChange1h > 20) {
        filterStats.priceChange1h++;
        rejected = `1h ${priceChange1h.toFixed(1)}%`;
      }
      // Transactions
      else if (txns24h < 100) {
        filterStats.transactions++;
        rejected = `Txns ${txns24h}`;
      }
      else {
        filterStats.passed++;
        rejected = '✅ PASSED';
      }
      
      samples.push({
        symbol: p?.baseToken?.symbol || '???',
        fdv: Math.round(fdv),
        liq: Math.round(liquidityUsd),
        age: ageHours.toFixed(1),
        vol24h: Math.round(volumeH24),
        volRatio: (volumeRatio * 100).toFixed(1),
        volatility: volatility24h.toFixed(1),
        change1h: priceChange1h.toFixed(1),
        txns: txns24h,
        result: rejected,
      });
      
    } catch (err) {
      // Skip
    }
  }
  
  console.log('📊 Filter Rejection Stats (first 30 tokens checked):\n');
  console.log(`  Total checked: ${filterStats.total}`);
  console.log(`  No SOL pairs: ${filterStats.noPairs}`);
  console.log(`  Stablecoin: ${filterStats.stablecoin}`);
  console.log(`  ❌ Market Cap ($30K-$10M): ${filterStats.marketCap}`);
  console.log(`  ❌ Liquidity (<$15K): ${filterStats.liquidity}`);
  console.log(`  ❌ Pair Age (3-72h): ${filterStats.pairAge}`);
  console.log(`  ❌ 24h Volume (<$100K): ${filterStats.volume24h}`);
  console.log(`  ❌ Volume Ratio (<5%): ${filterStats.volumeRatio}`);
  console.log(`  ❌ Volatility (10-50%): ${filterStats.volatility}`);
  console.log(`  ❌ 1h Change (±20%): ${filterStats.priceChange1h}`);
  console.log(`  ❌ Transactions (<100): ${filterStats.transactions}`);
  console.log(`  ✅ PASSED ALL: ${filterStats.passed}`);
  
  console.log('\n📋 Sample Tokens:\n');
  samples.forEach((s, i) => {
    console.log(`${i + 1}. ${s.symbol}: MC=$${s.fdv} Liq=$${s.liq} Age=${s.age}h Vol24h=$${s.vol24h} VolRatio=${s.volRatio}% Vol=${s.volatility}% 1h=${s.change1h}% Txns=${s.txns} → ${s.result}`);
  });
}

diagnose().catch(console.error);
