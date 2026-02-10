'use client';

import { useState, useEffect } from 'react';

interface Position {
  mint: string;
  symbol?: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  priceUSD?: number;
  valueUSD?: number;
}

interface WalletData {
  wallet: string;
  positions: Position[];
}

export default function WalletCard() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadPositions() {
    try {
      const res = await fetch('/api/wallet/positions');
      if (!res.ok) throw new Error('Failed to load positions');
      const json = await res.json();
      setData(json);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!sendTo || !sendAmount) return;
    setSending(true);
    try {
      const res = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: sendTo, amountSol: parseFloat(sendAmount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      alert(`Sent! Tx: ${json.signature}`);
      setSendTo('');
      setSendAmount('');
      loadPositions();
    } catch (e: any) {
      alert(`Send error: ${e.message}`);
    } finally {
      setSending(false);
    }
  }

  async function handleSell(mint: string, symbol: string) {
    if (!confirm(`Sell all ${symbol || mint.slice(0, 8)} to SOL?`)) return;
    try {
      const res = await fetch('/api/wallet/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint }),
      });
      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.error || 'Sell failed';
        const details = json.stderr ? `\n\nDetails:\n${json.stderr}` : '';
        throw new Error(errorMsg + details);
      }
      if (json.success) {
        alert(`Sold to SOL!\n\nTx: ${json.signature}\n\n${json.explorerUrl || ''}`);
        loadPositions();
      } else {
        alert(json.message || 'Sell failed');
      }
    } catch (e: any) {
      alert(`Sell error: ${e.message}`);
    }
  }

  const totalValueUSD = data?.positions.reduce((sum, p) => sum + (p.valueUSD || 0), 0) || 0;

  if (loading) return <div className="p-4 border rounded">Loading wallet...</div>;
  if (error) return <div className="p-4 border rounded text-red-500">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="p-4 border rounded space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Wallet</h2>
        <div className="text-sm text-gray-500">
          {data.wallet.slice(0, 8)}...{data.wallet.slice(-8)}
        </div>
      </div>

      {totalValueUSD > 0 && (
        <div className="text-2xl font-bold text-green-600">
          ${totalValueUSD.toFixed(2)}
        </div>
      )}

      {/* Send SOL Form */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="To address"
          value={sendTo}
          onChange={e => setSendTo(e.target.value)}
          className="flex-1 px-2 py-1 border rounded text-sm"
        />
        <input
          type="number"
          step="0.001"
          placeholder="SOL"
          value={sendAmount}
          onChange={e => setSendAmount(e.target.value)}
          className="w-24 px-2 py-1 border rounded text-sm"
        />
        <button
          onClick={handleSend}
          disabled={sending || !sendTo || !sendAmount}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>

      {/* Positions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Token</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Value</th>
              <th className="text-right py-2">Sell</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.map((pos, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">
                  <div className="font-mono text-xs font-semibold">{pos.symbol || pos.mint.slice(0, 8)}</div>
                </td>
                <td className="text-right">{pos.uiAmount.toFixed(6)}</td>
                <td className="text-right">
                  {pos.priceUSD && pos.priceUSD > 0 ? `$${pos.priceUSD.toFixed(6)}` : '—'}
                </td>
                <td className="text-right font-semibold">
                  {pos.valueUSD && pos.valueUSD > 0 ? `$${pos.valueUSD.toFixed(2)}` : '—'}
                </td>
                <td className="text-right">
                  {pos.mint !== 'So11111111111111111111111111111111111111112' && pos.mint !== '11111111111111111111111111111111' && (
                    <button
                      onClick={() => handleSell(pos.mint, pos.symbol || '')}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                    >
                      Sell
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
