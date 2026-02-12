#!/usr/bin/env node
const mint = process.argv[2];
if (!mint) {
  console.log('Usage: node checkToken.mjs <mint>');
  process.exit(1);
}

const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
const res = await fetch(url);
const json = await res.json();

const pairs = json?.pairs?.filter(p => p?.chainId === 'solana') || [];
if (pairs.length === 0) {
  console.log('❌ No Solana pairs found');
  process.exit(1);
}

pairs.sort((a, b) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0));
const p = pairs[0];

const now = Date.now();
const pairAge = p?.pairCreatedAt ? now - p.pairCreatedAt : 999999999;
const ageHours = pairAge / (1000 * 60 * 60);

const fdv = Number(p?.fdv ?? 0);
const liquidityUsd = Number(p?.liquidity?.usd ?? 0);
const volumeH1 = Number(p?.volume?.h1 ?? 0);
const volumeM5 = Number(p?.volume?.m5 ?? 0);
const volumeH24 = Number(p?.volume?.h24 ?? 0);
const priceChangeM5 = Number(p?.priceChange?.m5 ?? 0);
const priceChange1h = Number(p?.priceChange?.h1 ?? 0);
const priceChange24h = Number(p?.priceChange?.h24 ?? 0);
const txns24h = Number(p?.txns?.h24?.buys ?? 0) + Number(p?.txns?.h24?.sells ?? 0);

console.log(`\n📊 Token: ${p?.baseToken?.symbol || 'Unknown'}`);
console.log(`   Mint: ${mint}`);
console.log(`   Chart: ${p?.url || 'N/A'}`);
console.log(`\n💰 Stats:`);
console.log(`   Price: $${p?.priceUsd || 0}`);
console.log(`   Market Cap: $${Math.round(fdv).toLocaleString()}`);
console.log(`   Liquidity: $${Math.round(liquidityUsd).toLocaleString()}`);
console.log(`   Age: ${ageHours.toFixed(1)}h`);
console.log(`\n📈 Volume:`);
console.log(`   24h: $${Math.round(volumeH24).toLocaleString()}`);
console.log(`   1h: $${Math.round(volumeH1).toLocaleString()}`);
console.log(`   5m: $${Math.round(volumeM5).toLocaleString()}`);
console.log(`\n📊 Momentum:`);
console.log(`   24h: ${priceChange24h.toFixed(1)}%`);
console.log(`   1h: ${priceChange1h.toFixed(1)}%`);
console.log(`   5m: ${priceChangeM5.toFixed(1)}%`);
console.log(`\n💹 Transactions (24h): ${txns24h}`);

console.log(`\n✅ FILTER CHECK:\n`);

// Our criteria
const checks = {
  'Market Cap ($50K - $10M)': fdv >= 50000 && fdv <= 10000000,
  'Liquidity (≥$8,500)': liquidityUsd >= 8500,
  'Age (0.5h - 2 years)': ageHours >= 0.5 && ageHours <= 17520,
  '1h Volume (≥$10K)': volumeH1 >= 10000,
  '5min Volume (≥$1K)': volumeM5 >= 1000,
  'Transactions (≥10 in 24h)': txns24h >= 10,
};

for (const [check, pass] of Object.entries(checks)) {
  console.log(`   ${pass ? '✅' : '❌'} ${check}`);
}

console.log('');
