import { Connection } from '@solana/web3.js';

export function getRpcUrl(): string {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (!rpc) throw new Error('NEXT_PUBLIC_SOLANA_RPC is not set');
  return rpc;
}

export function getConnection(): Connection {
  return new Connection(getRpcUrl(), 'confirmed');
}

export function explorerTxUrl(sig: string) {
  return `https://solscan.io/tx/${sig}`;
}
