'use client';

import { useEffect, useState } from 'react';
import { getComputeQuote, formatLamports } from '../../lib/raydium/quote';
import type { TProposal } from '../../lib/storage/types';

// Example proposal (adjust to your targets)
const EXAMPLE_PAIRS = [
  {
    id: 'ex-1',
    pair: 'PUMP/SOL',
    // replace with real SPL mint addresses if needed
    inputMint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    outputMint: 'So11111111111111111111111111111111111111112', // wSOL
    tokenDecimals: 6,
    slippageBps: 150,
    amountRaw: 210_000_000, // 210 with 6 decimals
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
          const payload: TProposal = {
        id,
        pair: p.pair,
        slippageBps: p.slippageBps,
      };
      alert(`YES (stub). Would execute:$ {JSON.stringify(payload)}`);
      };

  return (
    <div style={{ padding: 16 }}>
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
