'use client';

import { useEffect, useState } from 'react';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';

const WSOL = 'So11111111111111111111111111111111111111112';

type TrendingItem = {
  pairAddress?: string;
  url?: string;
  base?: { address?: string; symbol?: string; name?: string };
  quote?: { address?: string; symbol?: string; name?: string };
  priceUsd?: number;
  volumeH24?: number;
  liquidityUsd?: number;
  fdv?: number;
};

export default function MarketsPage() {
  const { publicKey, sendTransaction } = useWallet();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch('/api/trending/solana', { cache: 'no-store' });
      if (!res.ok) throw new Error(`trending ${res.status}`);
      const json = await res.json();
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setErr(e?.message ?? 'failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onBuyWithSol = async (mint: string, amountRawLamports = 1_000_000, slippageBps = 100) => {
    if (!publicKey) { alert('Connect Phantom first.'); return; }
    const ok = confirm(`Buy with SOL?\nMint: ${mint}\nAmount SOL: ${amountRawLamports / 1e9}`);
    if (!ok) return;
    try {
      const owner = publicKey;
      const inputMint = new PublicKey(WSOL); // SOL in (wrap)
      const outputMint = new PublicKey(mint);
      const inputAccount = getAssociatedTokenAddressSync(inputMint, owner);
      const outputAccount = getAssociatedTokenAddressSync(outputMint, owner);

      const built = await buildRaydiumSwapBaseInTx({
        inputMint: WSOL,
        outputMint: mint,
        amount: String(amountRawLamports),
        slippageBps,
        txVersion: 'V0',
        wallet: publicKey.toBase58(),
        inputAccount: inputAccount.toBase58(),
        outputAccount: outputAccount.toBase58(),
      });

      const conn = getConnection();
      const sig = await sendTransaction(built.transaction as any, conn);
      alert(`Sent! ${sig}\n${explorerTxUrl(sig)}`);
    } catch (e: any) {
      alert(`Buy failed: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <WalletConnect />
        <button onClick={load} disabled={loading} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Top 10 Trending (24h · DexScreener · Solana)</div>
      {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>Error: {err}</div>}
      {!items.length ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>No data.</div>
      ) : (
        items.map((it, idx) => (
          <div key={it.pairAddress ?? idx} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>
              {it.base?.symbol ?? it.base?.name ?? it.base?.address} / {it.quote?.symbol ?? it.quote?.name ?? it.quote?.address}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              price: {it.priceUsd != null ? `$${it.priceUsd.toFixed(6)}` : '—'} | vol24h: {it.volumeH24 != null ? `$${Math.round(it.volumeH24).toLocaleString()}` : '—'} | liq: {it.liquidityUsd != null ? `$${Math.round(it.liquidityUsd).toLocaleString()}` : '—'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => onBuyWithSol(it.base?.address ?? '')} style={{ padding: '6px 10px', borderRadius: 6, background: '#111827', color: '#fff' }}>
                Buy {it.base?.symbol ?? 'token'} with SOL (0.001)
              </button>
              {it.url && (
                <a href={it.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', padding: '6px 10px' }}>DexScreener</a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
