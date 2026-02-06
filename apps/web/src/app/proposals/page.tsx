'use client';

import { useEffect, useState } from 'react';
<<<<<<< HEAD
import toast from 'react-hot-toast';
import { useWallet } from '@solana/wallet-adapter-react';
=======
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';

>>>>>>> 49a25e2b6 (feat(web): show input and output USD prices via Jupiter (free))
import { WalletConnect } from '@/components/WalletConnect';
import { getComputeQuote, formatLamports } from '@/lib/raydium/quote';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';
<<<<<<< HEAD
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { getBirdeyeToken } from '@/lib/birdeye';

type Proposal = {
  id: string;
  status?: string;
  pair: string;
  inputMint: string;
  outputMint: string;
  slippageBps: number;
  amountRaw: number;
  txVersion?: 'LEGACY' | 'V0';
};

export default function Page() {
  const { publicKey, sendTransaction } = useWallet();
  const [simulateOnly, setSimulateOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [quotes, setQuotes] = useState<Record<string, { amountOut?: string; otherAmountThreshold?: string }>>({});
  const [market, setMarket] = useState<Record<string, { price?: number; liquidity?: number; v24hUSD?: number; symbol?: string }>>({});

  async function fetchProposals() {
    try {
      const res = await fetch('/api/proposals', { cache: 'no-store' });
      if (!res.ok) throw new Error(`proposals fetch ${res.status}`);
      const data = await res.json();
      const list: Proposal[] = Array.isArray(data) ? data : (data?.proposals ?? []);
      const filtered = list.filter((p) => (p.status ?? 'PROPOSED') === 'PROPOSED');
      setProposals(filtered.slice(0, 10));
    } catch (e: any) {
      toast.error(`Load proposals failed: ${e?.message ?? String(e)}`);
    }
  }

  useEffect(() => {
    fetchProposals();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next: typeof quotes = {};
      const mk: typeof market = {};
      for (const p of proposals) {
        try {
          const q = await getComputeQuote({
            inputMint: p.inputMint,
            outputMint: p.outputMint,
            amount: p.amountRaw,
            slippageBps: p.slippageBps,
            txVersion: p.txVersion ?? 'V0',
          });
          next[p.id] = { amountOut: q.amountOut, otherAmountThreshold: q.otherAmountThreshold };
        } catch {}
        try {
          // Prefer output token stats
          const m = await getBirdeyeToken(p.outputMint);
          if (m) mk[p.id] = m;
        } catch {}
      }
      if (!cancelled) {
        setQuotes(next);
        setMarket(mk);
      }
    };
    if (proposals.length) {
      refresh();
      const t = setInterval(refresh, 20000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
  }, [proposals]);

  const onRefresh = async () => {
    try {
      const res = await fetch('/api/proposals/refresh', { method: 'POST' });
      if (!res.ok) throw new Error(`refresh ${res.status}`);
      const out = await res.json();
      toast.success(`Refreshed (${out.count})`);
      await fetchProposals();
    } catch (e: any) {
      toast.error(`Refresh failed: ${e?.message ?? String(e)}`);
    }
  };

  const onYes = async (id: string) => {
    const p = proposals.find((x) => x.id === id);
    if (!p) return;

    if (simulateOnly) {
      toast.success(`Simulate only: ${p.pair} amount=${formatLamports(p.amountRaw, 9)}`);
      return;
    }
    if (!publicKey) {
      toast.error('Connect Phantom first.');
      return;
    }

    try {
      setLoading(true);
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
        txVersion: p.txVersion ?? 'V0',
        wallet: publicKey.toBase58(),
        inputAccount: inputAccount.toBase58(),
        outputAccount: outputAccount.toBase58(),
      });

      const conn = getConnection();
      const sig = await sendTransaction(built.transaction as any, conn);
      toast.success(`Sent: ${sig}`, { duration: 5000 });
      window.open(explorerTxUrl(sig), '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(`Swap failed: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
=======
import { getJupiterPriceUsd } from '@/lib/price';

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
  prices,
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
  prices?: { in?: number | null; out?: number | null } | null;
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
      {prices && (
        <div style={{ fontSize: 12, marginTop: 6, color: '#111827' }}>
          price(in): {prices.in != null ? `$${prices.in.toFixed(6)}` : '—'} | price(out):{' '}
          {prices.out != null ? `$${prices.out.toFixed(6)}` : '—'}
        </div>
      )}
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

      // Fetch input/output prices from free Jupiter API (via our proxy)
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
>>>>>>> 49a25e2b6 (feat(web): show input and output USD prices via Jupiter (free))
    }
  };

  return (
    <div style={{ padding: 16 }}>
<<<<<<< HEAD
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <WalletConnect />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
          <input type="checkbox" checked={simulateOnly} onChange={(e) => setSimulateOnly(e.target.checked)} />
          Simulate only
        </label>
        <button onClick={onRefresh} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
          Refresh proposals
        </button>
      </div>

      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Proposals</div>
      {!proposals.length ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>No proposals found.</div>
      ) : (
        proposals.map((p) => (
          <div key={p.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>{p.pair}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              amount: {formatLamports(p.amountRaw, 9)} | slippage: {p.slippageBps} bps
            </div>
            {quotes[p.id] && (
              <div style={{ fontSize: 12, marginTop: 6 }}>
                est out: {formatLamports(quotes[p.id].amountOut ?? '0', 6)} | min out:{' '}
                {formatLamports(quotes[p.id].otherAmountThreshold ?? '0', 6)}
              </div>
            )}
            {market[p.id] && (
              <div style={{ fontSize: 12, marginTop: 6, color: '#111827' }}>
                price: ${market[p.id]?.price?.toFixed(6) ?? '—'} | liq: $
                {market[p.id]?.liquidity ? Math.round(market[p.id]!.liquidity!).toLocaleString() : '—'} | vol24h: $
                {market[p.id]?.v24hUSD ? Math.round(market[p.id]!.v24hUSD!).toLocaleString() : '—'}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => onYes(p.id)}
                disabled={loading}
                style={{ padding: '6px 10px', borderRadius: 6, background: '#111827', color: '#fff' }}
              >
                {simulateOnly ? 'YES (Simulate)' : 'YES (Execute)'}
              </button>
            </div>
          </div>
        ))
      )}
=======
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
          prices={priceMap[p.id] ?? null}
        />
      ))}
>>>>>>> 49a25e2b6 (feat(web): show input and output USD prices via Jupiter (free))
    </div>
  );
}
