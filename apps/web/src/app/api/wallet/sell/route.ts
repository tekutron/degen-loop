import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'node:fs/promises';

const KEYPAIR_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';

export async function POST(req: Request) {
  try {
    const { mint, percent } = await req.json();
    
    if (!mint || !percent) {
      return NextResponse.json({ error: 'Missing mint or percent' }, { status: 400 });
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

    // Get token account balance
    const mintPubkey = new PublicKey(mint);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      keypair.publicKey,
      { mint: mintPubkey }
    );

    if (tokenAccounts.value.length === 0) {
      return NextResponse.json({ error: 'No token account found' }, { status: 404 });
    }

    const tokenAccount = tokenAccounts.value[0];
    const balance = tokenAccount.account.data.parsed.info.tokenAmount.amount;
    const decimals = tokenAccount.account.data.parsed.info.tokenAmount.decimals;
    
    // Calculate amount to sell
    const amountToSell = Math.floor((BigInt(balance) * BigInt(percent)) / 100n);
    
    if (amountToSell === 0n) {
      return NextResponse.json({ error: 'Amount too small' }, { status: 400 });
    }

    // TODO: Implement Raydium swap (token → wSOL)
    // For now, return a placeholder
    return NextResponse.json({
      success: false,
      message: 'Sell not yet implemented - need Raydium SDK integration',
      mint,
      percent,
      amountToSell: amountToSell.toString(),
      decimals,
    });
  } catch (e: any) {
    console.error('POST /api/wallet/sell error:', e);
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
