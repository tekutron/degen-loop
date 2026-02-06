'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

import { WalletConnect } from '@/components/WalletConnect';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { buildRaydiumSwapBaseInTx } from '@/lib/raydium/tx';
import { formatByMint, getTokenInfo, getTokenDecimals } from '@/lib/tokens';

// Use wSOL for sells by default
const WSOL = 'So11111111111111111111111111111111111111112';

// Basic inferred type; your bot can extend this shape
type Position = {
  id?: string;
  mint: string;
  symbol?: string;
  amountRaw?: string | number; // token raw amount (decimals unknown here)
  tokenDecimals?: number; // optional; default 6
  // extra fields from your bot can be present and will be rendered
  [k: string]: any;
};

export default function PositionsPage() {
  const { publicKey, sendTransaction } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const res = await fetch('/api/positions', { cache: 'no-store' });
      if (!res.ok) throw new Error(`positions fetch ${res.status}`);
      const data = await res.json();
      const list: Position[] = Array.isArray(data?.positions) ? data.positions : [];
      setPositions(list);
    } catch (e: any) {
      setErr(e?.message ?? 'failed');
    }
  }

  useEffect(() => { load(); }, []);

  const onSellNow = async (pos: Position) => {
    if (!publicKey) { alert('Connect Phantom first.'); return; }
    const amountRawNum = typeof pos.amountRaw === 'string' ? Number(pos.amountRaw) : (pos.amountRaw ?? 0);
    if (!pos.mint || !amountRawNum) { alert('Missing mint or amount'); return; }

    const ok = confirm(`Sell NOW?\nMint: ${pos.mint}\nAmountRaw: ${amountRawNum}`);
    if (!ok) return;

    try {
      setLoading(true);
      const owner = publicKey;
      const inputMint = new PublicKey(pos.mint);
      const outputMint = new PublicKey(WSOL); // sell to wSOL by default
      const inputAccount = getAssociatedTokenAddressSync(inputMint, owner);
      const outputAccount = getAssociatedTokenAddressSync(outputMint, owner);

      const built = await buildRaydiumSwapBaseInTx({
        inputMint: pos.mint,
        outputMint: WSOL,
        amount: String(amountRawNum),
        slippageBps: 100, // 1% default for sells; adjust in Settings later
        txVersion: 'V0',
        wallet: publicKey.toBase58(),
        inputAccount: inputAccount.toBase58(),
        outputAccount: outputAccount.toBase58(),
      });

      const conn = getConnection();
      const sig = await sendTransaction(built.transaction as any, conn);
      alert(`Sent! ${sig}\n${explorerTxUrl(sig)}`);
    } catch (e: any) {
      alert(`Sell failed: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <WalletConnect />
        <button onClick={load} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>Refresh</button>
      </div>

      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Positions</div>
      {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>Error: {err}</div>}
      {!positions.length ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>No positions.</div>
      ) : (
        positions.map((p, idx) => {
          const meta = getTokenInfo(p.mint);
          const sym = p.symbol ?? meta.symbol ?? p.mint;
          const amountStr = formatByMint(p.mint, p.amountRaw ?? 0);
          const dec = p.tokenDecimals ?? getTokenDecimals(p.mint, 6);
          return (
            <div key={p.id ?? `${p.mint}-${idx}`} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>{sym}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                amount: {amountStr} (decimals={dec})
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => onSellNow(p)}
                  disabled={loading}
                  style={{ padding: '6px 10px', borderRadius: 6, background: '#111827', color: '#fff' }}
                >
                  Sell NOW
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
