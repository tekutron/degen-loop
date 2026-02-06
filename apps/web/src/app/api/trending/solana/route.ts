import { NextResponse } from 'next/server';

const BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/latest/v1';
const TOKEN_URL = (addr: string) => `https://api.dexscreener.com/latest/dex/tokens/${addr}`;

export async function GET() {
  try {
    // 1) Get boosted/trending tokens list (free)
    const boostsRes = await fetch(BOOSTS_URL, { cache: 'no-store' });
    if (!boostsRes.ok) {
      const txt = await boostsRes.text().catch(() => '');
      return NextResponse.json({ error: `dexscreener boosts ${boostsRes.status}`, body: txt.slice(0, 400) }, { status: 502 });
    }
    const boosts: any[] = await boostsRes.json();

    const sol = boosts.filter((b) => (b?.chainId ?? '').toLowerCase() === 'solana' && b?.tokenAddress);
    const topTokens = sol.slice(0, 10).map((b) => String(b.tokenAddress));

    // 2) For each token, fetch its pairs and pick the best Solana pair by 24h volume
    const results = await Promise.all(
      topTokens.map(async (addr) => {
        const res = await fetch(TOKEN_URL(addr), { cache: 'no-store' });
        if (!res.ok) return null;
        const json = await res.json();
        const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];
        const solPairs = pairs.filter((p) => (p?.chainId ?? '').toLowerCase() === 'solana');
        solPairs.sort((a, b) => Number(b?.volume?.h24 ?? 0) - Number(a?.volume?.h24 ?? 0));
        const p = solPairs[0];
        if (!p) return null;
        return {
          pairAddress: p?.pairAddress,
          url: p?.url,
          base: {
            address: p?.baseToken?.address,
            symbol: p?.baseToken?.symbol,
            name: p?.baseToken?.name,
          },
          quote: {
            address: p?.quoteToken?.address,
            symbol: p?.quoteToken?.symbol,
            name: p?.quoteToken?.name,
          },
          chainId: p?.chainId,
          dexId: p?.dexId,
          priceUsd: typeof p?.priceUsd === 'string' ? Number(p.priceUsd) : p?.priceUsd,
          volumeH24: Number(p?.volume?.h24 ?? 0),
          liquidityUsd: Number(p?.liquidity?.usd ?? 0),
          fdv: p?.fdv ? Number(p.fdv) : undefined,
        };
      })
    );

    const items = results.filter(Boolean);
    // If some token fetches failed, we might have < 10; that's ok.
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
