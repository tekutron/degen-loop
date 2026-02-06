'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

import { WalletConnect } from '@/components/WalletConnect';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';
import { getComputeQuote } from '@/lib/raydium/quote';
import { formatByMint } from '@/lib/tokens';
import { getJupiterPriceUsd } from '@/lib/price';

const WSOL = 'So11111111111111111111111111111111111111112';

function u8ToBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  // eslint-disable-next-line no-undef
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

export default function DashboardPage() {
  const { publicKey, sendTransaction } = useWallet();

  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [quoteMap, setQuoteMap] = useState<Record<string, { amountOut?: string; otherAmountThreshold?: string }>>({});
  const [priceMap, setPriceMap] = useState<Record<string, { in?: number | null; out?: number | null }>>({});

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    try {
      setErr(null);
      const [tRes, pRes, posRes] = await Promise.all([
        fetch('/api/trending/solana', { cache: 'no-store' }),
        fetch('/api/proposals', { cache: 'no-store' }),
        fetch('/api/positions', { cache: 'no-store' }),
      ]);

      const tJson = tRes.ok ? await tRes.json() : null;
      const pJson = pRes.ok ? await pRes.json() : null;
      const posJson = posRes.ok ? await posRes.json() : null;

      setTrending(Array.isArray(tJson?.items) ? tJson.items : []);

      const pList: Proposal[] = Array.isArray(pJson) ? pJson : (pJson?.proposals ?? []);
      setProposals(pList.filter((p) => (p.status ?? 'PROPOSED') === 'PROPOSED').slice(0, 10));

      setPositions(Array.isArray(posJson?.positions) ? posJson.positions : []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // refresh quotes + prices for proposals
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
          const [pin, pout] = await Promise.all([getJupiterPriceUsd(p.inputMint), getJupiterPriceUsd(p.outputMint)]);
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
      const t = setInterval(run, 20_000);
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

  const sellPosition = async (pos: Position) => {
    try {
      setBusy(true);
      const amt = typeof pos.amountRaw === 'string' ? Number(pos.amountRaw) : (pos.amountRaw ?? 0);
      if (!pos.mint || !amt) return alert('Missing mint/amount');
      const ok = confirm(`Sell NOW?\nMint: ${pos.mint}\nAmountRaw: ${amt}`);
      if (!ok) return;
      const built = await buildSwap({ inputMint: pos.mint, outputMint: WSOL, amountRaw: amt, slippageBps: 100 });
      const conn = getConnection();
      const sig = await sendTransaction(built.transaction as any, conn);
      alert(`Sent! ${sig}\n${explorerTxUrl(sig)}`);
    } catch (e: any) {
      alert(`Sell failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <WalletConnect />
        <button onClick={loadAll} disabled={busy} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
          Refresh all
        </button>
        <a href="/settings" style={{ color: '#2563eb' }}>Settings</a>
      </div>

      {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>Error: {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
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
                  <button onClick={() => buyTrending(it.base?.address)} disabled={busy} style={{ padding: '4px 8px', borderRadius: 6, background: '#111827', color: '#fff' }}>
                    Buy 0.001 SOL
                  </button>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 12, padding: '4px 0' }}>DexScreener</a>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Proposals */}
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Proposals (Top 10)</div>
          {!proposals.length ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No proposals.</div>
          ) : (
            proposals.map((p) => {
              const q = quoteMap[p.id];
              const pr = priceMap[p.id];
              return (
                <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.pair}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    in: {formatByMint(p.inputMint, p.amountRaw)} | out est: {q?.amountOut ? formatByMint(p.outputMint, q.amountOut) : '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#111827' }}>
                    price(in): {pr?.in != null ? `$${pr.in.toFixed(6)}` : '—'} | price(out): {pr?.out != null ? `$${pr.out.toFixed(6)}` : '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button onClick={() => simProposal(p)} disabled={busy} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #111827', background: '#fff' }}>
                      Sim
                    </button>
                    <button onClick={() => yesProposal(p)} disabled={busy} style={{ padding: '4px 8px', borderRadius: 6, background: '#111827', color: '#fff' }}>
                      YES
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Positions */}
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Positions</div>
          {!positions.length ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No positions.</div>
          ) : (
            positions.slice(0, 10).map((pos, idx) => {
              const amt = pos.amountRaw ?? 0;
              return (
                <div key={pos.id ?? `${pos.mint}-${idx}`} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{pos.symbol ?? pos.mint}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>amount: {formatByMint(pos.mint, amt)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button onClick={() => sellPosition(pos)} disabled={busy} style={{ padding: '4px 8px', borderRadius: 6, background: '#111827', color: '#fff' }}>
                      Sell NOW
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
        Tip: You can still use the dedicated pages: <a href="/markets" style={{ color: '#2563eb' }}>/markets</a>, <a href="/proposals" style={{ color: '#2563eb' }}>/proposals</a>, <a href="/positions" style={{ color: '#2563eb' }}>/positions</a>.
      </div>
    </div>
  );
}
