import fs from 'node:fs';
import path from 'node:path';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getMint } from '@solana/spl-token';

const DESKTOP_CSV = '/home/j/Desktop/sol_trades.csv';
const PROPOSALS_JSON = path.resolve('./trade_proposals.json');

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const RAYDIUM_COMPUTE_BASE_IN = 'https://transaction-v1.raydium.io/compute/swap-base-in';

function nowIso() {
  return new Date().toISOString();
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[\n\r,\"]/g.test(s)) return '"' + s.replaceAll('"', '""') + '"';
  return s;
}

function appendCsv(row) {
  if (!fs.existsSync(DESKTOP_CSV)) {
    const header = [
      'timestamp','event','proposalId','mint','pair','direction','amountIn','amountInUnit','expectedOut','slippageBps','stopLossPct','takeProfitPct','dexUrl','raydiumRoutePoolId','txSig','status','notes'
    ].join(',') + '\n';
    fs.writeFileSync(DESKTOP_CSV, header);
  }
  fs.appendFileSync(DESKTOP_CSV, row.map(csvEscape).join(',') + '\n');
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function loadKeypair(walletPath) {
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

function loadProposals() {
  if (!fs.existsSync(PROPOSALS_JSON)) return { updatedAt: null, proposals: [] };
  return JSON.parse(fs.readFileSync(PROPOSALS_JSON, 'utf8'));
}

function saveProposals(doc) {
  fs.writeFileSync(PROPOSALS_JSON, JSON.stringify(doc, null, 2) + '\n');
}

function genId() {
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}

async function raydiumComputeBaseIn({ inputMint, outputMint, amountIn, slippageBps }) {
  const url = new URL(RAYDIUM_COMPUTE_BASE_IN);
  url.searchParams.set('inputMint', inputMint.toBase58());
  url.searchParams.set('outputMint', outputMint.toBase58());
  url.searchParams.set('amount', String(amountIn));
  url.searchParams.set('slippageBps', String(slippageBps));
  url.searchParams.set('txVersion', 'LEGACY');

  const json = await fetchJson(url.toString());
  if (!json?.success) throw new Error(`Raydium compute failed: ${json?.msg || json?.error || 'unknown'}`);

  const route0 = json?.data?.routePlan?.[0];
  return {
    poolId: route0?.poolId || null,
    expectedOut: BigInt(json?.data?.outputAmount || 0),
    priceImpactPct: json?.data?.priceImpactPct,
  };
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const walletPath = process.env.SWAP_WALLET || './wallets/generated_keypair.json';
  const tokenMintStr = process.env.TOKEN_MINT; // required
  const entrySol = Number(process.env.ENTRY_SOL || '0.01');
  const slippageBps = Number(process.env.SLIPPAGE_BPS || '150');
  const stopLossPct = Number(process.env.STOPLOSS_PCT || '12');
  const takeProfitPct = Number(process.env.TAKEPROFIT_PCT || '20');
  const intervalSec = Number(process.env.CHECK_INTERVAL_SEC || '60');

  if (!tokenMintStr) throw new Error('Set TOKEN_MINT');

  const conn = new Connection(rpcUrl, 'confirmed');
  const owner = loadKeypair(walletPath);
  const tokenMint = new PublicKey(tokenMintStr);

  const mintInfo = await getMint(conn, tokenMint);
  const decimals = mintInfo.decimals;

  const ata = getAssociatedTokenAddressSync(tokenMint, owner.publicKey, false);

  const takeProfitSol = entrySol * (1 + takeProfitPct / 100);
  const stopLossSol = entrySol * (1 - stopLossPct / 100);

  appendCsv([
    nowIso(), 'MONITOR_START', '', tokenMint.toBase58(), '', 'TOKEN->SOL', '', '', '', slippageBps, stopLossPct, takeProfitPct, '', '', '', 'RUNNING',
    `entrySol=${entrySol}; tpSol=${takeProfitSol.toFixed(6)}; slSol=${stopLossSol.toFixed(6)}; intervalSec=${intervalSec}; decimals=${decimals}`
  ]);

  // Loop until threshold hit.
  // NOTE: we do not auto-sell; we create a SELL proposal and print instructions.
  for (;;) {
    let tokenBalRaw = 0n;
    try {
      const bal = await conn.getTokenAccountBalance(ata, 'confirmed');
      tokenBalRaw = BigInt(bal.value.amount);
    } catch {
      tokenBalRaw = 0n;
    }

    if (tokenBalRaw === 0n) {
      appendCsv([nowIso(), 'MONITOR', '', tokenMint.toBase58(), '', 'TOKEN->SOL', '0', 'TOKEN', '', slippageBps, stopLossPct, takeProfitPct, '', '', '', 'NO_POSITION', 'token balance is 0']);
      await new Promise(r => setTimeout(r, intervalSec * 1000));
      continue;
    }

    // Compute expected SOL out for selling full position.
    let compute;
    try {
      compute = await raydiumComputeBaseIn({ inputMint: tokenMint, outputMint: WSOL_MINT, amountIn: tokenBalRaw.toString(), slippageBps });
    } catch (e) {
      appendCsv([nowIso(), 'MONITOR', '', tokenMint.toBase58(), '', 'TOKEN->SOL', tokenBalRaw.toString(), 'TOKEN', '', slippageBps, stopLossPct, takeProfitPct, '', '', '', 'QUOTE_FAIL', String(e?.message || e)]);
      await new Promise(r => setTimeout(r, intervalSec * 1000));
      continue;
    }

    const expectedSol = Number(compute.expectedOut) / LAMPORTS_PER_SOL;

    appendCsv([
      nowIso(), 'MONITOR', '', tokenMint.toBase58(), '', 'TOKEN->SOL', tokenBalRaw.toString(), 'TOKEN', expectedSol.toFixed(9), slippageBps, stopLossPct, takeProfitPct, '', compute.poolId || '', '', 'OK',
      `priceImpactPct=${compute.priceImpactPct}`
    ]);

    const hitTP = expectedSol >= takeProfitSol;
    const hitSL = expectedSol <= stopLossSol;

    if (hitTP || hitSL) {
      const proposalId = genId();
      const doc = loadProposals();
      doc.updatedAt = nowIso();
      doc.proposals = doc.proposals || [];

      const proposal = {
        id: proposalId,
        createdAt: nowIso(),
        mint: tokenMint.toBase58(),
        pair: 'PUMP/SOL',
        dexUrl: '',
        direction: 'TOKEN->SOL',
        amountInTokenRaw: tokenBalRaw.toString(),
        tokenDecimals: decimals,
        slippageBps,
        stopLossPct,
        takeProfitPct,
        raydiumPoolId: compute.poolId,
        expectedOutSol: expectedSol,
        reason: hitTP ? 'TAKE_PROFIT' : 'STOP_LOSS',
        status: 'READY_TO_SELL'
      };

      doc.proposals.unshift(proposal);
      doc.proposals = doc.proposals.slice(0, 80);
      saveProposals(doc);

      appendCsv([
        nowIso(), 'SELL_SIGNAL', proposalId, tokenMint.toBase58(), 'PUMP / SOL', 'TOKEN->SOL', tokenBalRaw.toString(), 'TOKEN', expectedSol.toFixed(9), slippageBps, stopLossPct, takeProfitPct, '', compute.poolId || '', '', 'READY_TO_SELL', proposal.reason
      ]);

      console.log(JSON.stringify({
        signal: proposal.reason,
        proposalId,
        tokenMint: tokenMint.toBase58(),
        tokenBalanceRaw: tokenBalRaw.toString(),
        expectedSolOut: expectedSol,
        entrySol,
        takeProfitSol,
        stopLossSol,
        slippageBps,
        poolId: compute.poolId,
        action: `Reply: CONFIRM SELL ${proposalId}`
      }, null, 2));

      return;
    }

    await new Promise(r => setTimeout(r, intervalSec * 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
