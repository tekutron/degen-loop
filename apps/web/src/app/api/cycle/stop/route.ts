import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const JUPBOT_DIR = '/home/j/.openclaw/workspace/jupbot';
const PID_FILE = `${JUPBOT_DIR}/cycle.pid`;

async function liquidateAll(): Promise<{ ok: boolean; pid?: number }> {
  return await new Promise((resolve) => {
    const env = {
      ...process.env,
      MAIN_WALLET: '1',
      SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
      SWAP_WALLET: process.env.SWAP_WALLET,
    };
    const p = spawn('node', ['liquidateAll.mjs'], { cwd: JUPBOT_DIR, env, stdio: 'ignore' });
    p.on('close', () => resolve({ ok: true }));
    // Don't hang the HTTP; let it run in background
    setTimeout(() => resolve({ ok: true, pid: p.pid }), 200);
  });
}

export async function POST() {
  try {
    // 1) Start background liquidation of all positions
    const liq = await liquidateAll();

    // 2) Stop cycle loop if running
    let pid: number | null = null;
    try {
      const pidTxt = await fs.readFile(PID_FILE, 'utf-8');
      pid = Number(pidTxt.trim());
      if (pid) {
        try { process.kill(pid, 'SIGTERM'); } catch {}
      }
    } catch {}

    return NextResponse.json({ ok: true, liquidationStarted: true, stopped: !!pid, pid });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'stop failed' }, { status: 500 });
  }
}
