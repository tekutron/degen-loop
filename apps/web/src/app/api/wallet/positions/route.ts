import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'node:fs/promises';

const KEYPAIR_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

interface TokenAccount {
  mint: string;
  symbol?: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  priceUSD?: number;
  valueUSD?: number;
}

export async function GET() {
  try {
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || process.env.QUICKNODE_RPC;
    if (!rpc) {
      return NextResponse.json({ error: 'No RPC configured' }, { status: 500 });
    }

    // Load keypair to get wallet address
    const kpData = await fs.readFile(KEYPAIR_PATH, 'utf-8');
    const kpArray = JSON.parse(kpData);
    const walletPubkey = new PublicKey(
      // Derive pubkey from secret key array
      Buffer.from(kpArray.slice(32, 64))
    );

    const connection = new Connection(rpc, 'confirmed');

    // Get SOL balance
    const solBalance = await connection.getBalance(walletPubkey);
    const solUiAmount = solBalance / 1e9;

    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    const positions: TokenAccount[] = [];

    // Add SOL
    positions.push({
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      amount: solBalance.toString(),
      decimals: 9,
      uiAmount: solUiAmount,
    });

    // Add SPL tokens with balance > 0
    for (const acc of tokenAccounts.value) {
      const parsed = acc.account.data.parsed;
      const info = parsed?.info;
      if (!info || info.tokenAmount.uiAmount === 0) continue;

      positions.push({
        mint: info.mint,
        amount: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
        uiAmount: info.tokenAmount.uiAmount,
      });
    }

    // Enrich with prices from Jupiter
    const mints = positions.map(p => p.mint).join(',');
    const priceRes = await fetch(`${JUPITER_PRICE_API}?ids=${mints}`);
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      for (const pos of positions) {
        const price = priceData.data?.[pos.mint]?.price;
        if (price) {
          pos.priceUSD = price;
          pos.valueUSD = pos.uiAmount * price;
        }
      }
    }

    return NextResponse.json({
      wallet: walletPubkey.toBase58(),
      positions: positions.filter(p => p.uiAmount > 0),
    });
  } catch (e: any) {
    console.error('GET /api/wallet/positions error:', e);
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
