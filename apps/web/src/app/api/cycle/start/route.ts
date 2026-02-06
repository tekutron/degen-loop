import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const JUPBOT_DIR = '/home/j/.openclaw/workspace/jupbot';
const PID_FILE = `${JUPBOT_DIR}/cycle.pid`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sizeSol = Number(body?.sizeSol);
    if (!sizeSol || !Number.isFinite(sizeSol) || sizeSol <= 0) {
      return NextResponse.json({ error: 'sizeSol must be > 0' }, { status: 400 });
    }

    // If already running, return current pid
    try {
      const pidTxt = await fs.readFile(PID_FILE, 'utf-8');
      const pid = Number(pidTxt.trim());
      if (pid) return NextResponse.json({ ok: true, alreadyRunning: true, pid });
    } catch {}

    const env = {
      ...process.env,
      MAIN_WALLET: '1',
      SIZE_SOL: String(sizeSol),
      // Reuse existing swap wallet config if present
      SWAP_WALLET: process.env.SWAP_WALLET,
      SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
    };

    const child = spawn('node', ['degenCycle.mjs'], {
      cwd: JUPBOT_DIR,
      env,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return NextResponse.json({ ok: true, pid: child.pid });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'start failed' }, { status: 500 });
  }
}
