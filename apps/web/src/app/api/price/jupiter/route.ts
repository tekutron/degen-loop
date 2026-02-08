import { NextResponse } from 'next/server';

async function fetchJupiterPrice(mint: string) {
  const headers = {
    'accept': 'application/json',
    'user-agent': 'degen-loop/1.0 (+github.com/tekutron/degen-loop)'
  } as const;

  // Primary (v6)
  const u6 = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(mint)}`;
  let res = await fetch(u6, { headers, cache: 'no-store' });
  if (res.ok) return res.json();

  // Fallbacks
  // v4
  const u4 = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(mint)}`;
  res = await fetch(u4, { headers, cache: 'no-store' });
  if (res.ok) return res.json();

  // legacy v2 (different shape but still includes data[mint].price)
  const u2 = `https://price.jup.ag/v2/price?ids=${encodeURIComponent(mint)}`;
  res = await fetch(u2, { headers, cache: 'no-store' });
  if (res.ok) return res.json();

  const txt = await res.text().catch(() => '');
  throw new Error(`jupiter price failed: ${res.status} ${res.statusText} ${txt.slice(0, 200)}`);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mint = url.searchParams.get('mint');
    if (!mint) return NextResponse.json({ error: 'mint is required' }, { status: 400 });

    const data = await fetchJupiterPrice(mint);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 502 });
  }
}
