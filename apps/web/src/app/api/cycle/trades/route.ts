import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';

const FILE = '/home/j/.openclaw/workspace/jupbot/cycle_trades.json';

export async function GET() {
  try {
    const txt = await fs.readFile(FILE, 'utf-8');
    const arr = JSON.parse(txt);
    return NextResponse.json({ trades: Array.isArray(arr) ? arr : [] });
  } catch (e: any) {
    return NextResponse.json({ trades: [] });
  }
}
