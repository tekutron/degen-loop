import { NextResponse } from 'next/server';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

function getRpcUrl(): string {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (!rpc) throw new Error('NEXT_PUBLIC_SOLANA_RPC is not set');
  return rpc;
}

function fromBase64ToUint8(b64: string): Uint8Array {
  const buf = Buffer.from(b64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
}

export async function POST(req: Request) {
  try {
    const { txBase64, version = 'V0' } = await req.json();
    if (!txBase64) return NextResponse.json({ error: 'txBase64 is required' }, { status: 400 });

    const conn = new Connection(getRpcUrl(), 'confirmed');

    const txBytes = fromBase64ToUint8(txBase64);
    let tx: VersionedTransaction | Transaction;
    if (version === 'LEGACY') {
      tx = Transaction.from(txBytes);
    } else {
      tx = VersionedTransaction.deserialize(txBytes);
    }

    const sim = await conn.simulateTransaction(tx as any, { replaceRecentBlockhash: true, commitment: 'processed' });

    return NextResponse.json({ ok: true, value: sim.value });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'simulate failed' }, { status: 500 });
  }
}
