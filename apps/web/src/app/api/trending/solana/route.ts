import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read from cycle_state.json to show the exact Raydium top volume coins the bot is trading
    const cycleStatePath = '/home/j/.openclaw/workspace/jupbot/cycle_state.json';
    
    let trending: any[] = [];
    try {
      const data = fs.readFileSync(cycleStatePath, 'utf8');
      const cycleState = JSON.parse(data);
      trending = Array.isArray(cycleState?.trending) ? cycleState.trending : [];
    } catch (err) {
      // If cycle_state.json doesn't exist or can't be read, return empty
      console.warn('Could not read cycle_state.json:', err);
      return NextResponse.json({ items: [] });
    }

    // Map cycle trending format to API format
    const items = trending.map((t) => ({
      pairAddress: undefined, // Not available in cycle state
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
      dexId: 'raydium',
      priceUsd: t?.priceUsd,
      volumeH24: t?.volumeH24,
      liquidityUsd: t?.liquidityUsd,
      fdv: undefined,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
