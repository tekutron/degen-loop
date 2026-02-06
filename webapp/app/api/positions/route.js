export async function GET(){
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.resolve(process.cwd(), '..', 'jupbot', 'positions.json');
    const text = await fs.readFile(file, 'utf8');
    const json = JSON.parse(text);
    const rows = (json.positions||[]).map(p=>({
      source: 'jupbot',
      mint: p.mint,
      pair: p.pair,
      amountRaw: p.amountInTokenRaw,
      tokenDecimals: p.tokenDecimals,
      entrySol: p.entrySol,
      openedAt: p.openedAt,
      dexscreener: p.dexUrl
    }));
    return new Response(JSON.stringify({updatedAt: json.updatedAt||new Date().toISOString(), rows}), {status:200, headers:{'content-type':'application/json'}});
  } catch (e) {
    return new Response(JSON.stringify({error: e.message}), {status:500, headers:{'content-type':'application/json'}});
  }
}
