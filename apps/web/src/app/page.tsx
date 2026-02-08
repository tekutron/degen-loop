'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

import { WalletConnect } from '@/components/WalletConnect';
import WalletCard from '@/components/WalletCard';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';
import { getComputeQuote } from '@/lib/raydium/quote';
import { formatByMint } from '@/lib/tokens';
import { getJupiterPriceUsd } from '@/lib/price';

const WSOL = 'So11111111111111111111111111111111111111112';

function u8ToBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

type TrendingItem = {
  pairAddress?: string;
  url?: string;
  base?: { address?: string; symbol?: string; name?: string };
  quote?: { address?: string; symbol?: string; name?: string };
  priceUsd?: number;
  volumeH24?: number;
  liquidityUsd?: number;
};

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

type Position = {
  id?: string;
  mint: string;
  symbol?: string;
  amountRaw?: string | number;
  tokenDecimals?: number;
  [k: string]: any;
};

type CycleState = {
  running?: boolean;
  stage?: string;
  idx?: number;
  trending?: any[];
  current?: any;
  entryPriceUsd?: number;
  tpPrice?: number;
  slPrice?: number;
  lastPriceUsd?: number;
  updatedAt?: string;
  error?: string;
  pid?: number;
};

type Trade = {
  status?: string;
  mint?: string;
  symbol?: string;
  entryAt?: string;
  entrySig?: string;
  entryPriceUsd?: number;
  tpPrice?: number;
  slPrice?: number;
  amountRaw?: string;
  exitAt?: string;
  exitSig?: string;
  exitPriceUsd?: number;
  pnlPct?: number;
};

export default function DashboardPage() {
  const { publicKey, sendTransaction } = useWallet();

  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  const [quoteMap, setQuoteMap] = useState<Record<string, { amountOut?: string; otherAmountThreshold?: string }>>({});
  const [priceMap, setPriceMap] = useState<Record<string, { in?: number | null; out?: number | null }>>({});

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cycle control
  const [sizeSol, setSizeSol] = useState('0.01');
  const [cycle, setCycle] = useState<CycleState | null>(null);
  const [cycleLoading, setCycleLoading] = useState(false);

  const loadTrades = async () => {
    try {
      const res = await fetch('/api/cycle/trades', { cache: 'no-store' });
      const json = await res.json();
      setTrades(Array.isArray(json?.trades) ? json.trades : []);
    } catch {}
  };

  const loadCycle = async () => {
    try {
      setCycleLoading(true);
      const res = await fetch('/api/cycle/status', { cache: 'no-store' });
      const json = await res.json();
      setCycle(json);
    } catch {} finally {
      setCycleLoading(false);
    }
  };

  const startCycle = async () => {
    try {
      setCycleLoading(true);
      const num = Number(sizeSol);
      if (!num || num <= 0) {
        // lazy import to avoid hard dep at top
        const { toast } = await import('react-hot-toast');
        toast?.error?.('Enter a valid size in SOL');
        return;
      }
      const res = await fetch('/api/cycle/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizeSol: num }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        const { toast } = await import('react-hot-toast');
        toast?.error?.(`Start failed: ${json?.error ?? res.status}`);
        return;
      }
      const { toast } = await import('react-hot-toast');
      const pidStr = (json?.pid ?? '').toString();
      toast?.success?.(`Cycle started (pid ${pidStr})`);
      await loadCycle();
    } catch (e: any) {
      const { toast } = await import('react-hot-toast');
      toast?.error?.(`Start failed: ${e?.message ?? String(e)}`);
    } finally {
      setCycleLoading(false);
    }
  };

  const stopCycle = async () => {
    try {
      setCycleLoading(true);
      const res = await fetch('/api/cycle/stop', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        const { toast } = await import('react-hot-toast');
        toast?.error?.(`Stop failed: ${json?.error ?? res.status}`);
        return;
      }
      const { toast } = await import('react-hot-toast');
      toast?.success?.('Cycle stop requested');
      await loadCycle();
      await loadTrades();
    } catch (e: any) {
      const { toast } = await import('react-hot-toast');
      toast?.error?.(`Stop failed: ${e?.message ?? String(e)}`);
    } finally {
      setCycleLoading(false);
    }
  };

  const loadAll = async () => {
    try {
      setErr(null);
      const [tRes, pRes] = await Promise.all([
        fetch('/api/trending/solana', { cache: 'no-store' }),
        fetch('/api/proposals', { cache: 'no-store' }),
      ]);
      const tJson = tRes.ok ? await tRes.json() : null;
      const pJson = pRes.ok ? await pRes.json() : null;
      setTrending(Array.isArray(tJson?.items) ? tJson.items : []);
      const pList: Proposal[] = Array.isArray(pJson) ? pJson : (pJson?.proposals ?? []);
      setProposals(pList.filter((p) => (p.status ?? 'PROPOSED') === 'PROPOSED').slice(0, 10));
      await Promise.all([loadCycle(), loadTrades()]);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const nextQ: typeof quoteMap = {};
      const nextP: typeof priceMap = {};
      for (const p of proposals) {
        try {
          const q = await getComputeQuote({
            inputMint: p.inputMint,
            outputMint: p.outputMint,
            amount: p.amountRaw,
            slippageBps: p.slippageBps,
            txVersion: p.txVersion ?? 'V0',
          });
          nextQ[p.id] = { amountOut: q.amountOut, otherAmountThreshold: q.otherAmountThreshold };
        } catch {}
        try {
          const [pin, pout] = await Promise.all([
            getJupiterPriceUsd(p.inputMint),
            getJupiterPriceUsd(p.outputMint),
          ]);
          nextP[p.id] = { in: pin, out: pout };
        } catch {}
      }
      if (!cancelled) {
        setQuoteMap(nextQ);
        setPriceMap(nextP);
      }
    };
    if (proposals.length) {
      run();
      const t = setInterval(run, 20000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
  }, [proposals]);

  const buildSwap = async (args: {
    inputMint: string;
    outputMint: string;
    amountRaw: number;
    slippageBps: number;
  }) => {
    if (!publicKey) throw new Error('Connect Phantom first');
    const owner = publicKey;
    const inputMintPk = new PublicKey(args.inputMint);
    const outputMintPk = new PublicKey(args.outputMint);
    const inputAccount = getAssociatedTokenAddressSync(inputMintPk, owner);
    const outputAccount = getAssociatedTokenAddressSync(outputMintPk, owner);
    return buildRaydiumSwapBaseInTx({
      inputMint: args.inputMint,
      outputMint: args.outputMint,
      amount: String(args.amountRaw),
      slippageBps: args.slippageBps,
      txVersion: 'V0',
      wallet: publicKey.toBase58(),
      inputAccount: inputAccount.toBase58(),
      outputAccount: outputAccount.toBase58(),
    });
  };

  const onSimTx = async (built: { txVersion: 'LEGACY' | 'V0'; transaction: any }) => {
    const bytes: Uint8Array = (built.transaction as any).serialize();
    const b64 = u8ToBase64(bytes);
    const res = await fetch('/api/tx/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txBase64: b64, version: built.txVersion ?? 'V0' }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error ?? `simulate ${res.status}`);
    return json.value;
  };

  const buyTrending = async (mint?: string) => {
    if (!mint) return;
    try {
      setBusy(true);
      const ok = confirm(`Buy with SOL?\nMint: ${mint}\nAmount: 0.001 SOL`);
      if (!ok) return;
      const built = await buildSwap({ inputMint: WSOL, outputMint: mint, amountRaw: 1_000_000, slippageBps: 100 });
      const conn = getConnection();
      const sig = await sendTransaction(built.transaction as any, conn);
      alert(`Sent! ${sig}\n${explorerTxUrl(sig)}`);
    } catch (e: any) {
      alert(`Buy failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const yesProposal = async (p: Proposal) => {
    try {
      setBusy(true);
      const ok = confirm(`Execute proposal?\n${p.pair}\nAmountRaw: ${p.amountRaw}`);
      if (!ok) return;
      const built = await buildSwap({ inputMint: p.inputMint, outputMint: p.outputMint, amountRaw: p.amountRaw, slippageBps: p.slippageBps });
      const conn = getConnection();
      const sig = await sendTransaction(built.transaction as any, conn);
      alert(`Sent! ${sig}\n${explorerTxUrl(sig)}`);
    } catch (e: any) {
      alert(`Execute failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const simProposal = async (p: Proposal) => {
    try {
      setBusy(true);
      const built = await buildSwap({ inputMint: p.inputMint, outputMint: p.outputMint, amountRaw: p.amountRaw, slippageBps: p.slippageBps });
      const v = await onSimTx(built as any);
      if (v.err) {
        alert(`Simulate: FAILED\nunits=${v.unitsConsumed ?? '—'}\nlogs=\n${(v.logs ?? []).join('\n')}`);
      } else {
        alert(`Simulate: OK\nunits=${v.unitsConsumed ?? '—'}\nlogs=\n${(v.logs ?? []).slice(-10).join('\n')}`);
      }
    } catch (e: any) {
      alert(`Simulate failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Top controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <WalletConnect />
        <button onClick={loadAll} disabled={busy} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>Refresh all</button>
        <a href="/settings" style={{ color: '#2563eb' }}>Settings</a>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 12 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Cycle size (SOL):</span>
          <input value={sizeSol} onChange={(e) => setSizeSol(e.target.value.replace(/[^0-9.]/g, ''))} style={{ width: 100, padding: 6, border: '1px solid #e5e7eb', borderRadius: 6 }} />
          <button onClick={startCycle} style={{ padding: '6px 10px', borderRadius: 6, background: '#111827', color: '#fff' }}>Start Cycle</button>
          <button onClick={stopCycle} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>Stop Cycle</button>
          <button onClick={loadCycle} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>Status</button>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{cycle?.running ? `Running (${cycle?.stage ?? ''})` : 'Stopped'}</span>
        </div>
      </div>

      {/* Three columns + Trades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* Trending */}
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Trending (Top 10 · 24h)</div>
          {!trending.length ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No data.</div>
          ) : (
            trending.map((it, idx) => (
              <div key={it.pairAddress ?? idx} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {it.base?.symbol ?? it.base?.name ?? it.base?.address}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  price: {it.priceUsd != null ? `$${it.priceUsd.toFixed(6)}` : '—'} | vol24h: {it.volumeH24 != null ? `$${Math.round(it.volumeH24).toLocaleString()}` : '—'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={() => buyTrending(it.base?.address)} disabled={busy} style={{ padding: '4px 8px', borderRadius: 6, background: '#111827', color: '#fff' }}>Buy 0.001 SOL</button>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 12, padding: '4px 0' }}>
                      DexScreener
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Wallet */}
        <WalletCard />

        {/* Trades */}
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Trades</div>
          {!trades.length ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No trades yet.</div>
          ) : (
            trades.slice(0, 20).map((t, idx) => (
              <div key={(t.entrySig || t.exitSig || idx).toString()} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.symbol ?? t.mint}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {t.entryAt ? `in: ${t.entryAt}` : ''} {t.exitAt ? ` · out: ${t.exitAt}` : ''}
                </div>
                <div style={{ fontSize: 12 }}>
                  {t.entryPriceUsd != null ? `entry: $${t.entryPriceUsd.toFixed(6)}` : 'entry: —'} {t.exitPriceUsd != null ? ` · exit: $${t.exitPriceUsd.toFixed(6)}` : ''} {t.pnlPct != null ? ` · PnL: ${t.pnlPct.toFixed(2)}%` : ''}
                </div>
                {(t.entrySig || t.exitSig) && (
                  <div style={{ fontSize: 12, color: '#6b7280', overflowWrap: 'anywhere' }}>
                    {t.entrySig ? `buy: ${t.entrySig}` : ''} {t.exitSig ? ` · sell: ${t.exitSig}` : ''}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </div>

      {cycle && (
        <div style={{ marginTop: 16, fontSize: 12, color: '#111827' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Cycle status</div>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 8, borderRadius: 6, overflowX: 'auto' }}>{JSON.stringify(cycle, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
