'use client';

import { useEffect, useState } from 'react';

function getLocal(key: string, def = ''): string {
  if (typeof window === 'undefined') return def;
  try { return window.localStorage.getItem(key) ?? def; } catch { return def; }
}
function setLocal(key: string, val: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, val); } catch {}
}
function delLocal(key: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key); } catch {}
}

export default function SettingsPage() {
  const [rpc, setRpc] = useState('');
  const [cluster, setCluster] = useState<'mainnet' | 'devnet'>('mainnet');
  const [slippageBps, setSlippageBps] = useState('50');

  useEffect(() => {
    setRpc(getLocal('rpcOverride', ''));
    const c = getLocal('clusterOverride', 'mainnet');
    setCluster(c === 'devnet' ? 'devnet' : 'mainnet');
    setSlippageBps(getLocal('defaultSlippageBps', '50'));
  }, []);

  const onSave = () => {
    setLocal('rpcOverride', rpc.trim());
    setLocal('clusterOverride', cluster);
    setLocal('defaultSlippageBps', slippageBps.trim());
    alert('Saved. Reload pages to apply.');
  };

  const onClear = () => {
    delLocal('rpcOverride');
    delLocal('clusterOverride');
    delLocal('defaultSlippageBps');
    alert('Cleared overrides.');
  };

  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Settings</div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>RPC Override</div>
        <input
          value={rpc}
          onChange={(e) => setRpc(e.target.value)}
          placeholder="https://api.mainnet-beta.solana.com"
          style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
        />
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Leave blank to use NEXT_PUBLIC_SOLANA_RPC (env). If cluster is set to devnet, default RPC becomes devnet.
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>Cluster</div>
        <select value={cluster} onChange={(e) => setCluster(e.target.value as any)} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <option value="mainnet">mainnet</option>
          <option value="devnet">devnet</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>Default Slippage (bps)</div>
        <input
          value={slippageBps}
          onChange={(e) => setSlippageBps(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="50"
          style={{ width: 160, padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} style={{ padding: '6px 10px', borderRadius: 6, background: '#111827', color: '#fff' }}>Save</button>
        <button onClick={onClear} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>Clear overrides</button>
      </div>
    </div>
  );
}
