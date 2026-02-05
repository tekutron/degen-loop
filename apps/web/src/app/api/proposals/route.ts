import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  try {
    const url = process.env.PROPOSALS_URL;
    const pth = process.env.PROPOSALS_PATH;

    if (url && /^https?:\/\//i.test(url)) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return NextResponse.json({ error: `fetch ${res.status}` }, { status: 502 });
      const data = await res.json();
      return NextResponse.json(data);
    }

    const filePath = pth
      ? pth
      : path.join(process.cwd(), 'apps', 'web', 'proposals.json');

    const buf = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(buf);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
