import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mint = url.searchParams.get('mint');
    if (!mint) return NextResponse.json({ error: 'mint is required' }, { status: 400 });

    const res = await fetch(`https://price.jup.ag/v6/price?ids=${encodeURIComponent(mint)}`, {
      headers: { 'accept': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json({ error: `jupiter ${res.status}`, body: txt.slice(0, 400) }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
