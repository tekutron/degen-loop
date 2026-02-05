'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/WalletConnect';
import { getComputeQuote, formatLamports } from '@/lib/raydium/quote';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';
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
    }
  };

  return (
    <div style={{ padding: 16 }}>
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
    </div>
  );
}
