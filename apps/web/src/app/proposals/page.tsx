'use client';

import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useEffect, useState } from 'react';
import { getComputeQuote, formatLamports } from '@/lib/raydium/quote';
import type { TProposal } from '@/lib/storage/types';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@solana/wallet-adapter-react';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';

// Example proposal (adjust to your targets)
const EXAMPLE_PAIRS = [
  {
    id: 'ex-1',
    pair: 'wSOL/USDC',
    inputMint: 'So11111111111111111111111111111111111111112', // wSOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    tokenDecimals: 9, // wSOL decimals
    slippageBps: 50,
    amountRaw: 1_000_000, // 0.001 SOL (in lamports)
  },
];

function ProposalCard({
  p,
  onYes,
  quoting,
  quote,
  error,
}: {
  p: {
    id: string;
    pair: string;
    inputMint: string;
    outputMint: string;
    tokenDecimals: number;
    slippageBps: number;
    amountRaw: number;
  };
  onYes: (id: string) => void;
  quoting: boolean;
  quote: { amountOut?: string; otherAmountThreshold?: string } | null;
  error?: string | null;
}) {
  return (
    <div
      style={{
        padding: 12,
        marginBottom: 12,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{p.pair}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        Amount In: {formatLamports(p.amountRaw, p.tokenDecimals)} | Slippage: {p.slippageBps} bps
      </div>
      {quoting ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Getting quote…</div>
      ) : error ? (
        <div style={{ fontSize: 12, color: '#dc2626' }}>Quote error: {error}</div>
      ) : quote ? (
        <div style={{ fontSize: 12, color: '#111827' }}>
          Est. Out: {formatLamports(quote.amountOut ?? '0', p.tokenDecimals)} | Min Out:{' '}
          {formatLamports(quote.otherAmountThreshold ?? '0', p.tokenDecimals)}
        </div>
      ) : null}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => onYes(p.id)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: '#111827',
            color: '#fff',
            border: '1px solid #111827',
          }}
        >
          YES (Execute)
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  const [proposals] = useState(EXAMPLE_PAIRS);
  const [quoting, setQuoting] = useState<Record<string, boolean>>({});
  const [quotes, setQuotes] = useState<Record<string, { amountOut?: string; otherAmountThreshold?: string }>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

const { publicKey, sendTransaction } = useWallet();


  const refreshQuotes = async () => {
    const nextQuoting: Record<string, boolean> = {};
    const nextQuotes: typeof quotes = {};
    const nextErrors: typeof errors = {};

    for (const p of proposals) {
      try {
        nextQuoting[p.id] = true;
        const q = await getComputeQuote({
          inputMint: p.inputMint,
          outputMint: p.outputMint,
          amount: p.amountRaw,
          slippageBps: p.slippageBps,
          txVersion: 'LEGACY',
        });
        nextQuotes[p.id] = { amountOut: q.amountOut, otherAmountThreshold: q.otherAmountThreshold };
        nextErrors[p.id] = null;
      } catch (e: any) {
        nextErrors[p.id] = e?.message ?? String(e);
      } finally {
        nextQuoting[p.id] = false;
      }
    }
    setQuoting(nextQuoting);
    setQuotes(nextQuotes);
    setErrors(nextErrors);
  };

  useEffect(() => {
    refreshQuotes();
    const t = setInterval(refreshQuotes, 20_000);
    return () => clearInterval(t);
  }, []);

const onYes = async (id: string) => {
  const p = proposals.find((x) => x.id === id);
  if (!p) return;

  if (!publicKey) {
    alert('Connect Phantom first.');
    return;
  }

  // Safety confirm
  const ok = confirm(`Execute swap via Raydium?\nPair: ${p.pair}\nAmountRaw: ${p.amountRaw}`);

if (!ok) return;

  try {
    const conn = getConnection();

const owner = publicKey; // wallet pubkey
const inputMint = new PublicKey(p.inputMint);
const outputMint = new PublicKey(p.outputMint);

const inputAccount = getAssociatedTokenAddressSync(inputMint, owner);
const outputAccount = getAssociatedTokenAddressSync(outputMint, owner);

    const built = await buildRaydiumSwapBaseInTx({
      inputMint: p.inputMint,
      outputMint: p.outputMint,
      amount: String(p.amountRaw),
      slippageBps: p.slippageBps,
      txVersion: 'V0',
      wallet: publicKey.toBase58(),
inputAccount: inputAccount.toBase58(),
  outputAccount: outputAccount.toBase58(),
    });

    const sig = await sendTransaction(built.transaction as any, conn);
    alert(`Sent! ${sig}\n${explorerTxUrl(sig)}`);
  } catch (e: any) {
    alert(`Swap failed: ${e?.message ?? String(e)}`);
  }
};


  return (
    <div style={{ padding: 16 }}>
<WalletConnect />      
<div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Proposals</div>
      {proposals.map((p) => (
        <ProposalCard
          key={p.id}
          p={p}
          onYes={onYes}
          quoting={!!quoting[p.id]}
          quote={quotes[p.id] ?? null}
          error={errors[p.id] ?? null}
        />
      ))}
    </div>
  );
}
