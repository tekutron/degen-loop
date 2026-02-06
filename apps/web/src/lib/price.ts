export async function getJupiterPriceUsd(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/price/jupiter?mint=${encodeURIComponent(mint)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    // jupiter response: { data: { [mint]: { id, price, mintSymbol, vsToken, vsTokenSymbol } } }
    const entry = json?.data?.[mint];
    const price = entry?.price;
    return typeof price === 'number' ? price : null;
  } catch {
    return null;
  }
}
