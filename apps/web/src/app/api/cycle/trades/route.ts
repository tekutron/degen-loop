import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';

const FILE = '/home/j/.openclaw/workspace/jupbot/cycle_trades.json';

export async function GET() {
  try {
    const txt = await fs.readFile(FILE, 'utf-8');
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr)) return NextResponse.json({ trades: [] });
    
    // Build a map to match CLOSED trades with their OPEN entry data
    const openMap = new Map<string, any>();
    for (const trade of arr) {
      if (trade.status === 'OPEN' && trade.entrySig) {
        openMap.set(trade.entrySig, trade);
      }
    }
    
    // Enrich CLOSED trades with entry data
    const enriched = arr.map((trade) => {
      if (trade.status === 'CLOSED') {
        // Try to find matching OPEN trade by looking backwards through the list
        let matchedEntry = null;
        for (let i = arr.indexOf(trade) + 1; i < arr.length; i++) {
          const candidate = arr[i];
          if (
            candidate.status === 'OPEN' &&
            candidate.mint === trade.mint &&
            candidate.symbol === trade.symbol
          ) {
            matchedEntry = candidate;
            break;
          }
        }
        
        if (matchedEntry) {
          return {
            ...trade,
            entryAt: matchedEntry.entryAt,
            entrySig: matchedEntry.entrySig,
            entryPriceUsd: matchedEntry.entryPriceUsd,
            tpPrice: matchedEntry.tpPrice,
            slPrice: matchedEntry.slPrice,
            amountRaw: matchedEntry.amountRaw,
            dexUrl: matchedEntry.dexUrl,
          };
        }
      }
      return trade;
    });
    
    // Filter to show only CLOSED trades (last 50) and OPEN trades
    const closedTrades = enriched.filter(t => t.status === 'CLOSED').slice(0, 50);
    const openTrades = enriched.filter(t => t.status === 'OPEN');
    
    return NextResponse.json({ trades: [...openTrades, ...closedTrades] });
  } catch (e: any) {
    return NextResponse.json({ trades: [] });
  }
}
