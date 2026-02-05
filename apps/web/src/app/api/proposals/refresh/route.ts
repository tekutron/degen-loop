import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function POST() {
  try {
    const cwd = process.cwd();
    const pairsPath = path.join(cwd, 'apps', 'web', 'pairs.json');
    const buf = await fs.readFile(pairsPath, 'utf-8');
    const pairs = JSON.parse(buf) as Array<{
      id: string;
      pair: string;
      inputMint: string;
      outputMint: string;
      decimalsIn?: number;
      decimalsOut?: number;
      defaultAmountRaw?: number;
      slippageBps?: number;
      txVersion?: 'LEGACY' | 'V0';
    }>;

    const now = new Date().toISOString();
    const proposals = pairs.map((p) => ({
      id: `${p.id}-${crypto.randomUUID().slice(0, 8)}`,
      status: 'PROPOSED',
      pair: p.pair,
      inputMint: p.inputMint,
      outputMint: p.outputMint,
      slippageBps: p.slippageBps ?? 50,
      amountRaw: p.defaultAmountRaw ?? 1_000_000,
      txVersion: p.txVersion ?? 'V0',
    }));

    // Where to write
    const envPath = process.env.PROPOSALS_PATH;
    const fallback = path.join(cwd, 'apps', 'web', 'proposals.json');
    const outPath = envPath && envPath.length > 0 ? envPath : fallback;

    const payload = { updatedAt: now, proposals };
    await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf-8');

    return NextResponse.json({ ok: true, outPath, count: proposals.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'refresh failed' }, { status: 500 });
  }
}
