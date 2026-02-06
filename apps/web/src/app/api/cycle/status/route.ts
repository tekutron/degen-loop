import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';

const STATE = '/home/j/.openclaw/workspace/jupbot/cycle_state.json';

export async function GET() {
  try {
    const txt = await fs.readFile(STATE, 'utf-8');
    const json = JSON.parse(txt);
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ running: false, error: e?.message ?? 'no state' }, { status: 200 });
  }
}
