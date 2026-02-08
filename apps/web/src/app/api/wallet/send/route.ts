import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import fs from 'node:fs/promises';

const KEYPAIR_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';

export async function POST(req: Request) {
  try {
    const { to, amountSol } = await req.json();
    
    if (!to || !amountSol) {
      return NextResponse.json({ error: 'Missing to or amountSol' }, { status: 400 });
    }

    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || process.env.QUICKNODE_RPC;
    if (!rpc) {
      return NextResponse.json({ error: 'No RPC configured' }, { status: 500 });
    }

    const connection = new Connection(rpc, 'confirmed');

    // Load bot keypair
    const kpData = await fs.readFile(KEYPAIR_PATH, 'utf-8');
    const kpArray = JSON.parse(kpData);
    const keypair = Keypair.fromSecretKey(Uint8Array.from(kpArray));

    // Build transfer tx
    const lamports = Math.floor(amountSol * 1e9);
    const toPubkey = new PublicKey(to);

    const ix = SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey,
      lamports,
    });

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    // Sign and send
    tx.sign(keypair);
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(sig, 'confirmed');

    return NextResponse.json({
      success: true,
      signature: sig,
      explorer: `https://solscan.io/tx/${sig}`,
    });
  } catch (e: any) {
    console.error('POST /api/wallet/send error:', e);
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
