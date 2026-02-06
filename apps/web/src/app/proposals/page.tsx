'use client';

import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';

import { WalletConnect } from '@/components/WalletConnect';
import { getComputeQuote } from '@/lib/raydium/quote';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';
import { getJupiterPriceUsd } from '@/lib/price';
import { formatByMint } from '@/lib/tokens';

// Example proposal (adjust to your targets)
const EXAMPLE_PAIRS = [
  {
    id: 'ex-1',
    pair: 'wSOL/USDC',
    inputMint: 'So11111111111111111111111111111111111111112', // wSOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    slippageBps: 50,
    amountRaw: 1_000_000, // 0.001 wSOL (lamports)
  },
];

function u8ToBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  // eslint-disable-next-line no-undef
  return btoa(s);
}

function ProposalCard({
  p,
  onYes,
  onSim,
  quoting,
  quote,
  error,
  prices,
}: {
  p: {
    id: string;
    pair: string;
    inputMint: string;
    outputMint: string;
    slippageBps: number;
    amountRaw: number;
  };
  onYes: (id: string) => void;
  onSim: (id: string) => void;
  quoting: boolean;
  quote: { amountOut?: string; otherAmountThreshold?: string } | null;
  error?: string | null;
  prices?: { in?: number | null; out?: number | null } | null;
}) {
  const amountInFmt = formatByMint(p.inputMint, p.amountRaw);
  const outFmt = quote?.amountOut ? formatByMint(p.outputMint, quote.amountOut) : null;
  const minOutFmt = quote?.otherAmountThreshold ? formatByMint(p.outputMint, quote.otherAmountThreshold) : null;

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
        Amount In: {amountInFmt} | Slippage: {p.slippageBps} bps
      </div>
      {quoting ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Getting quote…</div>
      ) : error ? (
        <div style={{ fontSize: 12, color: '#dc2626' }}>Quote error: {error}</div>
      ) : quote ? (
        <div style={{ fontSize: 12, color: '#111827' }}>
          Est. Out: {outFmt ?? '—'} | Min Out: {minOutFmt ?? '—'}
        </div>
      ) : null}
      {prices && (
        <div style={{ fontSize: 12, marginTop: 6, color: '#111827' }}>
          price(in): {prices.in != null ? `$${prices.in.toFixed(6)}` : '—'} | price(out):{' '}
          {prices.out != null ? `$${prices.out.toFixed(6)}` : '—'}
        </div>
      )}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSim(p.id)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #111827', background: '#fff', color: '#111827' }}
        >
          Simulate
        </button>
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
  const { publicKey, sendTransaction } = useWallet();

  const [proposals] = useState(EXAMPLE_PAIRS);
  const [quoting, setQuoting] = useState<Record<string, boolean>>({});
  const [quotes, setQuotes] = useState<Record<string, { amountOut?: string; otherAmountThreshold?: string }>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [priceMap, setPriceMap] = useState<Record<string, { in?: number | null; out?: number | null }>>({});

  const refreshQuotes = async () => {
    const nextQuoting: Record<string, boolean> = {};
    const nextQuotes: typeof quotes = {};
    const nextErrors: typeof errors = {};
    const nextPrices: typeof priceMap = {};

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

      try {
        const [pin, pout] = await Promise.all([
          getJupiterPriceUsd(p.inputMint),
          getJupiterPriceUsd(p.outputMint),
        ]);
        nextPrices[p.id] = { in: pin, out: pout };
      } catch {
        nextPrices[p.id] = { in: null, out: null };
      }
    }

    setQuoting(nextQuoting);
    setQuotes(nextQuotes);
    setErrors(nextErrors);
    setPriceMap(nextPrices);
  };

  useEffect(() => {
    refreshQuotes();
    const t = setInterval(refreshQuotes, 20_000);
    return () => clearInterval(t);
  }, []);

  const buildTxFor = async (p: (typeof proposals)[number]) => {
    if (!publicKey) throw new Error('Wallet not connected');
    const owner = publicKey;
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
    return built;
  };

  const onSim = async (id: string) => {
    const p = proposals.find((x) => x.id === id);
    if (!p) return;
    if (!publicKey) {
      alert('Connect Phantom first.');
      return;
    }
    try {
      const built = await buildTxFor(p);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bytes: Uint8Array = (built.transaction as any).serialize();
      const b64 = u8ToBase64(bytes);
      const res = await fetch('/api/tx/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txBase64: b64, version: built.txVersion ?? 'V0' }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `simulate ${res.status}`);
      const v = json.value;
      if (v.err) {
        alert(`Simulate: FAILED\nunits=${v.unitsConsumed ?? '—'}\nlogs=\n${(v.logs ?? []).join('\n')}`);
      } else {
        alert(`Simulate: OK\nunits=${v.unitsConsumed ?? '—'}\nlogs=\n${(v.logs ?? []).slice(-10).join('\n')}`);
      }
    } catch (e: any) {
      alert(`Simulate failed: ${e?.message ?? String(e)}`);
    }
  };

  const onYes = async (id: string) => {
    const p = proposals.find((x) => x.id === id);
    if (!p) return;

    if (!publicKey) {
      alert('Connect Phantom first.');
      return;
    }

    const ok = confirm(`Execute swap via Raydium?\nPair: ${p.pair}\nAmountRaw: ${p.amountRaw}`);
    if (!ok) return;

    try {
      const conn = getConnection();
      const built = await buildTxFor(p);
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
          onSim={onSim}
          quoting={!!quoting[p.id]}
          quote={quotes[p.id] ?? null}
          error={errors[p.id] ?? null}
          prices={priceMap[p.id] ?? null}
        />
      ))}
    </div>
  );
}
