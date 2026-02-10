import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read hot trending memes from the curated list
    const trendingFilePath = '/home/j/.openclaw/workspace/jupbot/trending_tokens_feb9.json';
    
    let trending: any[] = [];
    try {
      const data = fs.readFileSync(trendingFilePath, 'utf8');
      const trendingData = JSON.parse(data);
      trending = Array.isArray(trendingData?.trending) ? trendingData.trending : [];
    } catch (err) {
      // If trending file doesn't exist, try cycle_state.json as fallback
      try {
        const cycleStatePath = '/home/j/.openclaw/workspace/jupbot/cycle_state.json';
        const cycleData = fs.readFileSync(cycleStatePath, 'utf8');
        const cycleState = JSON.parse(cycleData);
        trending = Array.isArray(cycleState?.trending) ? cycleState.trending : [];
      } catch {
        return NextResponse.json({ items: [] });
      }
    }

    // Map trending format to API format
    const items = trending.map((t) => ({
      pairAddress: undefined,
      url: t?.dexUrl || undefined,
      base: {
        address: t?.mint,
        symbol: t?.symbol,
        name: t?.name,
      },
      quote: {
        address: 'So11111111111111111111111111111111111111112', // wSOL
        symbol: 'SOL',
        name: 'Wrapped SOL',
      },
      chainId: 'solana',
      dexId: t?.tier === '2' ? 'Tier 2 (Stable)' : 'High Risk',
      priceUsd: t?.priceUsd,
      volumeH24: t?.volumeH24,
      volumeH1: t?.volumeH1,
      liquidityUsd: t?.liquidityUsd,
      priceChange: {
        h1: t?.priceChange1h,
        h24: t?.priceChange24h,
      },
      fdv: undefined,
      tier: t?.tier,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
