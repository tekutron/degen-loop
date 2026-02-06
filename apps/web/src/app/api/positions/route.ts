import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';

const DEFAULT_PATH = '/home/j/.openclaw/workspace/jupbot/positions.json';

export async function GET() {
  try {
    const p = process.env.POSITIONS_PATH || DEFAULT_PATH;
    const txt = await fs.readFile(p, 'utf-8');
    const json = JSON.parse(txt);
    // Normalize: allow either {positions: [...]} or [...] directly
    const positions = Array.isArray(json) ? json : (json?.positions ?? []);
    return NextResponse.json({ positions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
