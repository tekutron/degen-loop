export type ComputeQuote = {
  amountOut: string;
  otherAmountThreshold: string;
  routePlan?: any[];
};

export type QuoteArgs = {
  inputMint: string;
  outputMint: string;
  amount: string | number; // raw lamports
  slippageBps?: number; // default 150
  txVersion?: 'LEGACY' | 'V0';
};

/**
 * Raydium compute: swap-base-in
 * Docs: https://transaction-v1.raydium.io/compute/swap-base-in
 */
export async function getComputeQuote({
  inputMint,
  outputMint,
  amount,
  slippageBps = 150,
  txVersion = 'LEGACY',
}: QuoteArgs): Promise<ComputeQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
    txVersion,
  });
  const url = `https://transaction-v1.raydium.io/compute/swap-base-in?${params.toString()}`;
  const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    throw new Error(`Raydium compute quote failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!data || !data.data) {
    throw new Error('Raydium compute: no data');
  }
  return {
    amountOut: String(data.data?.amountOut ?? '0'),
    otherAmountThreshold: String(data.data?.otherAmountThreshold ?? '0'),
    routePlan: data.data?.routePlan ?? [],
  };
}

/** Human-readable formatting of raw token amounts. */
export function formatLamports(raw: string | number, decimals = 6): string {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return (n / Math.pow(10, decimals)).toFixed(Math.min(decimals, 6));
}
