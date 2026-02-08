import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const JUPBOT_DIR = '/home/j/.openclaw/workspace/jupbot';
const PID_FILE = `${JUPBOT_DIR}/cycle.pid`;

async function isPidAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sizeSol = Number(body?.sizeSol);
    const slippageBps = body?.slippageBps != null ? Number(body.slippageBps) : undefined;
    if (!sizeSol || !Number.isFinite(sizeSol) || sizeSol <= 0) {
      return NextResponse.json({ error: 'sizeSol must be > 0' }, { status: 400 });
    }

    // If a PID file exists but the process is dead, ignore it
    try {
      const pidTxt = await fs.readFile(PID_FILE, 'utf-8');
      const pid = Number(pidTxt.trim());
      if (pid && await isPidAlive(pid)) {
        return NextResponse.json({ ok: true, alreadyRunning: true, pid });
      }
    } catch {}

    const env = {
      ...process.env,
      MAIN_WALLET: '1',
      SIZE_SOL: String(sizeSol),
      SLIPPAGE_BPS: String(slippageBps ?? process.env.SLIPPAGE_BPS ?? 100),
      SWAP_WALLET: process.env.SWAP_WALLET,
      SOLANA_RPC: process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC,
      FORCE_JUPITER: '1',
    } as NodeJS.ProcessEnv;

    const child = spawn('node', ['degenCycle.mjs'], {
      cwd: JUPBOT_DIR,
      env,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Persist PID for status/stop
    try { await fs.writeFile(PID_FILE, String(child.pid)); } catch {}

    return NextResponse.json({ ok: true, pid: child.pid, env: { SIZE_SOL: env.SIZE_SOL, SLIPPAGE_BPS: env.SLIPPAGE_BPS } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'start failed' }, { status: 500 });
  }
}
