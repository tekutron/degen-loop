import tokens from '../../tokens.json';

export type TokenInfo = { symbol?: string; decimals?: number };

const MAP: Record<string, TokenInfo> = tokens as any;

export function getTokenInfo(mint: string): TokenInfo {
  return MAP[mint] ?? {};
}

export function getTokenDecimals(mint: string, fallback = 6): number {
  const d = getTokenInfo(mint)?.decimals;
  return typeof d === 'number' ? d : fallback;
}

export function formatByMint(mint: string, raw: string | number): string {
  const decimals = getTokenDecimals(mint, 6);
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  const v = n / Math.pow(10, decimals);
  return v.toFixed(Math.min(decimals, 6));
}
