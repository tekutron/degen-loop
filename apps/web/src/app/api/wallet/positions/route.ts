import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'node:fs/promises';

const KEYPAIR_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const TOKENS_PATH = './tokens.json';

interface TokenAccount {
  mint: string;
  symbol?: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  priceUSD?: number;
  valueUSD?: number;
}

interface TokenMetadata {
  symbol?: string;
  decimals?: number;
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
    const keypair = Keypair.fromSecretKey(Uint8Array.from(kpArray));
    const walletPubkey = keypair.publicKey;

    const connection = new Connection(rpc, 'confirmed');

    // Load token metadata
    let tokensMetadata: Record<string, TokenMetadata> = {};
    try {
      const tokensData = await fs.readFile(TOKENS_PATH, 'utf-8');
      tokensMetadata = JSON.parse(tokensData);
    } catch {
      // tokens.json not found, continue without metadata
    }

    // Get SOL balance
    const solBalance = await connection.getBalance(walletPubkey);
    const solUiAmount = solBalance / 1e9;

    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    const positions: TokenAccount[] = [];

    // Add native SOL only if balance > 0
    if (solUiAmount > 0) {
      positions.push({
        mint: '11111111111111111111111111111111',
        symbol: 'SOL',
        amount: solBalance.toString(),
        decimals: 9,
        uiAmount: solUiAmount,
      });
    }

    // Add SPL tokens with balance > 0
    for (const acc of tokenAccounts.value) {
      const parsed = acc.account.data.parsed;
      const info = parsed?.info;
      if (!info || info.tokenAmount.uiAmount === 0) continue;

      const meta = tokensMetadata[info.mint];
      positions.push({
        mint: info.mint,
        symbol: meta?.symbol,
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
