export type BirdeyePrice = {
  success: boolean;
  data?: { value?: number };
};

export type BirdeyeOverview = {
  success: boolean;
  data?: {
    address?: string;
    symbol?: string;
    name?: string;
    liquidity?: number; // USD
    v24hUSD?: number;
    price?: number;
    decimals?: number;
  };
};

export async function getBirdeyeToken(mint: string): Promise<{ price?: number; liquidity?: number; v24hUSD?: number; symbol?: string } | null> {
  try {
    const res = await fetch(`/api/birdeye/token?mint=${encodeURIComponent(mint)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const price = (json?.price as BirdeyePrice)?.data?.value;
    const ov = (json?.overview as BirdeyeOverview)?.data;
    return {
      price: price ?? ov?.price,
      liquidity: ov?.liquidity,
      v24hUSD: ov?.v24hUSD,
      symbol: ov?.symbol,
    };
  } catch {
    return null;
  }
}
