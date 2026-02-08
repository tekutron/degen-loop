import { VersionedTransaction, Transaction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const API_BASE = 'https://transaction-v1.raydium.io';

type BuildSwapTxArgs = {
  // from compute quote
  inputAccount: string;
  outputAccount: string;
  inputMint: string;
  outputMint: string;
  amount: string; // raw lamports (for SOL) or raw spl-token units
  slippageBps: number;
  txVersion?: 'LEGACY' | 'V0';
  forceLegacy?: boolean;

  // wallet
  wallet: string; // public key base58
};

async function fetchPriorityFee(): Promise<number | undefined> {
  try {
    const r = await fetch('https://api.raydium.io/v2/main/priority-fee', { cache: 'no-store' });
    if (!r.ok) return undefined;
    const j = await r.json();
    const val = j?.data?.default ?? j?.data?.high ?? j?.data?.medium;
    return typeof val === 'number' ? Math.max(0, Math.floor(val)) : undefined;
  } catch { return undefined; }
}

export async function buildRaydiumSwapBaseInTx(args: BuildSwapTxArgs): Promise<{
  txVersion: 'LEGACY' | 'V0';
  transaction: Transaction | VersionedTransaction;
}> {
  const txVersion = args.forceLegacy ? 'LEGACY' : (args.txVersion ?? 'V0');

  // 1) compute quote (amount must be raw units)
  const computeParams = new URLSearchParams({
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: String(args.amount),
    slippageBps: String(args.slippageBps),
    txVersion,
  });
  const computeUrl = `${API_BASE}/compute/swap-base-in?${computeParams.toString()}`;
  console.log('[raydium/compute]', computeUrl);
  const computeRes = await fetch(computeUrl);
  if (!computeRes.ok) throw new Error(`Raydium compute failed: ${computeRes.status} ${computeRes.statusText}`);
  const computeJson = await computeRes.json();
  const computeData = computeJson?.data;
  if (!computeData) throw new Error('Raydium compute: missing data');

  // 2) priority fee (optional)
  const priority = await fetchPriorityFee();

  // 3) build transaction
  const txUrl = `${API_BASE}/transaction/swap-base-in`;
  const txBody = {
    computeUnitPriceMicroLamports: String(priority ?? computeData.computeUnitPriceMicroLamports ?? 0),
    swapResponse: computeJson,
    txVersion,
    wallet: args.wallet,
    inputAccount: args.inputAccount,
    outputAccount: args.outputAccount,
    wrapSol: true,
    unwrapSol: false,
  };
  console.log('[raydium/tx]', txUrl, 'body.computeUnitPriceMicroLamports=', txBody.computeUnitPriceMicroLamports);

  const txRes = await fetch(txUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txBody),
  });

  if (!txRes.ok) {
    const body = await txRes.text().catch(() => '');
    throw new Error(`Raydium tx build failed: ${txRes.status} ${txRes.statusText} body=${body.slice(0, 800)}`);
  }

  const txJson = await txRes.json();

  function findTxB64(x: any): string | undefined {
    if (!x) return;
    if (typeof x === 'string') {
      if (x.length > 200 && /^[A-Za-z0-9+/=]+$/.test(x)) return x;
      return;
    }
    if (Array.isArray(x)) {
      for (const item of x) {
        const r = findTxB64(item);
        if (r) return r;
      }
      return;
    }
    if (typeof x === 'object') {
      for (const k of ['transaction', 'tx', 'swapTransaction', 'serializedTransaction']) {
        const r = findTxB64((x as any)[k]);
        if (r) return r;
      }
      for (const v of Object.values(x)) {
        const r = findTxB64(v);
        if (r) return r;
      }
    }
  }

  const txB64 = findTxB64(txJson?.data ?? txJson);
  if (!txB64) {
    const preview = JSON.stringify(txJson).slice(0, 800);
    throw new Error(`Raydium tx build: could not find base64 transaction in response. resp=${preview}`);
  }

  const buf = Buffer.from(txB64, 'base64');
  if (txVersion === 'V0') {
    const vtx = VersionedTransaction.deserialize(buf);
    return { txVersion, transaction: vtx };
  } else {
    const ltx = Transaction.from(buf);
    return { txVersion, transaction: ltx };
  }
}
