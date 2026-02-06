import { Connection, clusterApiUrl } from '@solana/web3.js';

function getLocal(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function getRpcUrl(): string {
  const lsCluster = getLocal('clusterOverride'); // 'mainnet' | 'devnet'
  const lsRpc = getLocal('rpcOverride');
  if (lsRpc && lsRpc.trim()) return lsRpc.trim();
  if (lsCluster === 'devnet') return clusterApiUrl('devnet');
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (!rpc) throw new Error('NEXT_PUBLIC_SOLANA_RPC is not set');
  return rpc;
}

export function getConnection(): Connection {
  return new Connection(getRpcUrl(), 'confirmed');
}

export function explorerTxUrl(sig: string) {
  const lsCluster = getLocal('clusterOverride');
  const base = lsCluster === 'devnet' ? 'https://solscan.io/tx' : 'https://solscan.io/tx';
  const suffix = lsCluster === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/${sig}${suffix}`;
}
