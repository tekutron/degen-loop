import { NextResponse } from 'next/server';

const BIRDEYE_BASE = 'https://public-api.birdeye.so/defi';

async function beFetch(path: string, apiKey?: string) {
  const res = await fetch(`${BIRDEYE_BASE}${path}`, {
    headers: {
      'accept': 'application/json',
      'x-api-key': apiKey || '',
    },
    // disable Next cache for live data
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`birdeye ${path} ${res.status} ${res.statusText} ${txt.slice(0,200)}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mint = url.searchParams.get('mint');
    if (!mint) return NextResponse.json({ error: 'mint is required' }, { status: 400 });
    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'BIRDEYE_API_KEY not set' }, { status: 500 });

    const [price, overview] = await Promise.all([
      beFetch(`/price?address=${encodeURIComponent(mint)}`, apiKey),
      beFetch(`/token_overview?address=${encodeURIComponent(mint)}`, apiKey),
    ]);

    return NextResponse.json({ price, overview });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
