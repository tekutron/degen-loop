import { VersionedTransaction, Transaction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

type BuildSwapTxArgs = {
  // from compute quote
  inputAccount: string;
  outputAccount: string;
  inputMint: string;
  outputMint: string;
  amount: string; // raw
  slippageBps: number;
  txVersion?: 'LEGACY' | 'V0';

  // wallet
  wallet: string; // public key base58
};

export async function buildRaydiumSwapBaseInTx(args: BuildSwapTxArgs): Promise<{
  txVersion: 'LEGACY' | 'V0';
  transaction: Transaction | VersionedTransaction;
}> {
  const txVersion = args.txVersion ?? 'V0';

  // 1) compute quote
  const computeParams = new URLSearchParams({
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: String(args.amount),
    slippageBps: String(args.slippageBps),
    txVersion,
  });

  const computeUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?${computeParams.toString()}`;
  const computeRes = await fetch(computeUrl);
  if (!computeRes.ok) throw new Error(`Raydium compute failed: ${computeRes.status} ${computeRes.statusText}`);
  const computeJson = await computeRes.json();
  const computeData = computeJson?.data;
  if (!computeData) throw new Error('Raydium compute: missing data');

  // 2) build transaction
  const txUrl = `https://transaction-v1.raydium.io/transaction/swap-base-in`;
  const txBody = {
    computeUnitPriceMicroLamports: String(computeData.computeUnitPriceMicroLamports ?? 0),
    swapResponse: computeJson,
    txVersion,
    wallet: args.wallet,
  inputAccount: args.inputAccount,
  outputAccount: args.outputAccount,
    wrapSol: true,
    unwrapSol: false,
  };

  const txRes = await fetch(txUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txBody),
  });

if (!txRes.ok) {
  const body = await txRes.text().catch(() => '');
  throw new Error(`Raydium tx build failed: ${txRes.status} ${txRes.statusText} body=${body.slice(0,800)}`);
}

  const txJson = await txRes.json();

console.log('Raydium tx build response:', txJson);

function findTxB64(x: any): string | undefined {
  if (!x) return;
  if (typeof x === 'string') {
    // Raydium tx base64 strings are long; this is a simple heuristic
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
    // common key names
    for (const k of ['transaction', 'tx', 'swapTransaction', 'serializedTransaction']) {
      const r = findTxB64((x as any)[k]);
      if (r) return r;
    }
    // search everything
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
