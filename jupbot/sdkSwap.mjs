// Raydium SDK-based swap runner (ESM)
// Supports CLMM, CPMM, and Raydium AMM v4 (legacy Liquidity v4)
// Route is discovered via Raydium Trade API compute endpoint.

import fs from 'fs';
import axios from 'axios';
import BN from 'bn.js';

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';

import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

import raydiumSdk from '@raydium-io/raydium-sdk-v2';
const {
  Raydium,
  ALL_PROGRAM_ID,
  liquidityStateV4Layout,
  MARKET_STATE_LAYOUT_V3,
  getSerumAssociatedAuthority,
  makeAMMSwapInstruction,
  createWSolAccountInstructions,
} = raydiumSdk;

const WSOL = 'So11111111111111111111111111111111111111112';

async function getQuote({ inputMint, outputMint, amount, slippageBps, txVersion }) {
  const url = 'https://transaction-v1.raydium.io/compute/swap-base-in';
  const { data } = await axios.get(
    url,
    {
      params: {
        inputMint,
        outputMint,
        amount: String(amount),
        slippageBps: String(slippageBps),
        txVersion,
      },
      timeout: 10000,
    },
  );
  if (!data || !data.data) throw new Error('no compute quote');
  return data.data;
}

async function ensureAtaIx(connection, owner, mint, payer) {
  const ata = getAssociatedTokenAddressSync(mint, owner, false);
  const info = await connection.getAccountInfo(ata, 'confirmed');
  if (info) return { ata, createIx: null };
  return {
    ata,
    createIx: createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
  };
}

async function fetchAmmV4PoolKeys(connection, poolId) {
  const poolPk = new PublicKey(poolId);
  const acc = await connection.getAccountInfo(poolPk, 'confirmed');
  if (!acc) throw new Error(`pool account not found: ${poolId}`);

  if (!acc.owner.equals(ALL_PROGRAM_ID.AMM_V4)) {
    return { isAmmV4: false };
  }

  const state = liquidityStateV4Layout.decode(acc.data);
  const marketId = state.marketId;
  const marketProgramId = state.marketProgramId;

  const marketAcc = await connection.getAccountInfo(marketId, 'confirmed');
  if (!marketAcc) throw new Error(`market account not found: ${marketId.toBase58()}`);

  const marketState = MARKET_STATE_LAYOUT_V3.decode(marketAcc.data);
  const { publicKey: marketAuthority } = getSerumAssociatedAuthority({ programId: marketProgramId, marketId });

  const poolKeys = {
    id: poolPk.toBase58(),
    programId: ALL_PROGRAM_ID.AMM_V4.toBase58(),

    authority: state.owner.toBase58(),
    openOrders: state.openOrders.toBase58(),
    targetOrders: state.targetOrders.toBase58(),

    vault: {
      A: state.baseVault.toBase58(),
      B: state.quoteVault.toBase58(),
    },

    mintA: { address: state.baseMint.toBase58() },
    mintB: { address: state.quoteMint.toBase58() },
    mintLp: { address: state.lpMint.toBase58() },

    marketProgramId: marketProgramId.toBase58(),
    marketId: marketId.toBase58(),
    marketAuthority: marketAuthority.toBase58(),

    marketBaseVault: marketState.baseVault.toBase58(),
    marketQuoteVault: marketState.quoteVault.toBase58(),
    marketBids: marketState.bids.toBase58(),
    marketAsks: marketState.asks.toBase58(),
    marketEventQueue: marketState.eventQueue.toBase58(),
  };

  return {
    isAmmV4: true,
    poolKeys,
    mintA: new PublicKey(poolKeys.mintA.address),
    mintB: new PublicKey(poolKeys.mintB.address),
  };
}

export async function runSdkSwap({
  rpcUrl,
  walletPath,
  inputMint,
  outputMint,
  amountLamports,
  slippageBps = 100,
  txVersion = 'V0',
  maxAttempts = 10,
}) {
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const owner = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');

  const ray = await Raydium.load({ connection, owner, disableLoadToken: false });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const quote = await getQuote({
      inputMint,
      outputMint,
      amount: amountLamports,
      slippageBps,
      txVersion: txVersion === 'LEGACY' ? 'LEGACY' : 'V0',
    });

    const route = quote.routePlan || [];
    if (route.length !== 1) {
      // Route volatility: sometimes Raydium returns a 2-hop route. This runner only supports
      // single-hop (for now), so we re-quote/retry.
      if (attempt === maxAttempts) {
        throw new Error(`only single-hop routes supported in sdkSwap.mjs right now (got ${route.length})`);
      }
      continue;
    }

    const hop = route[0];
    const poolId = hop.poolId;

    const poolOwnerInfo = await connection.getAccountInfo(new PublicKey(poolId), 'confirmed');
    if (!poolOwnerInfo) throw new Error(`pool not found for id ${poolId}`);

    if (poolOwnerInfo.owner.equals(ALL_PROGRAM_ID.AMM_V4)) {
      const { isAmmV4, poolKeys, mintA, mintB } = await fetchAmmV4PoolKeys(connection, poolId);
      if (!isAmmV4) throw new Error('pool owner mismatch (expected amm v4)');

      const inMint = new PublicKey(inputMint);
      const outMint = new PublicKey(outputMint);

      if (!inMint.equals(mintA) && !inMint.equals(mintB)) {
        throw new Error(`input mint ${inMint.toBase58()} not in pool mints ${mintA.toBase58()} / ${mintB.toBase58()}`);
      }
      if (!outMint.equals(mintA) && !outMint.equals(mintB)) {
        throw new Error(`output mint ${outMint.toBase58()} not in pool mints ${mintA.toBase58()} / ${mintB.toBase58()}`);
      }

      if (inputMint !== WSOL) {
        throw new Error('AMM v4 path currently expects SOL input via WSOL mint');
      }

      const wsol = await createWSolAccountInstructions({
        connection,
        payer: owner.publicKey,
        owner: owner.publicKey,
        amount: new BN(String(amountLamports)),
        commitment: 'confirmed',
      });

      const { ata: outAta, createIx: createOutAtaIx } = await ensureAtaIx(connection, owner.publicKey, outMint, owner.publicKey);

      const amountIn = new BN(String(amountLamports));
      const minAmountOut = new BN(String(quote.otherAmountThreshold || '0'));
      if (minAmountOut.lten(0)) throw new Error('quote.otherAmountThreshold missing/invalid');

      const swapIx = makeAMMSwapInstruction({
        poolKeys,
        version: 4,
        fixedSide: 'in',
        amountIn,
        amountOut: minAmountOut,
        userKeys: {
          tokenAccountIn: wsol.addresses.newAccount,
          tokenAccountOut: outAta,
          owner: owner.publicKey,
        },
      });

      const cb = (await ray.utils1216.getComputeBudgetConfig?.()) || { units: 600000, microLamports: 5000 };

      const tx = new Transaction();
      tx.feePayer = owner.publicKey;
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: cb.units }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cb.microLamports }),
      );

      tx.add(...wsol.instructions);
      if (createOutAtaIx) tx.add(createOutAtaIx);
      tx.add(swapIx);
      if (wsol.endInstructions?.length) tx.add(...wsol.endInstructions);

      const sig = await connection.sendTransaction(tx, [owner], { skipPreflight: false });
      await connection.confirmTransaction(sig, 'confirmed');
      return [sig];
    }

    // CLMM / CPMM using SDK builders
    const useSOLBalanceIn = inputMint === WSOL;
    let poolInfo, poolKeys, isClmm = false;

    try {
      const r = await ray.clmm.getPoolInfoFromRpc(poolId);
      poolInfo = r.poolInfo;
      poolKeys = r.poolKeys;
      isClmm = true;
    } catch {
      // ignore
    }

    if (!poolInfo) {
      const r = await ray.cpmm.getRpcPoolInfo({ poolId });
      poolInfo = r;
      poolKeys = await ray.cpmm.getCpmmPoolKeys(poolId);
    }

    const slippage = slippageBps / 10000;
    const txv = txVersion === 'LEGACY' ? 1 : 0;

    if (isClmm) {
      // NOTE: CLMM swap() signature differs from CPMM. It requires inputMint/amountIn/amountOutMin.
      // Our route is discovered via the Trade API compute endpoint (swap-base-in), so we treat
      // `amountLamports` as amountIn and `quote.otherAmountThreshold` as amountOutMin.
      const amountIn = new BN(String(amountLamports));
      const amountOutMin = new BN(String(quote.otherAmountThreshold || '0'));
      if (amountOutMin.lten(0)) throw new Error('quote.otherAmountThreshold missing/invalid');

      const remainingAccounts = (hop.remainingAccounts || [])
        .map((a) => (typeof a === 'string' ? a : a?.toBase58?.() || a?.pubkey?.toBase58?.() || a?.pubkey))
        .filter(Boolean)
        .map((s) => new PublicKey(String(s)));

      const { execute } = await ray.clmm.swap({
        poolInfo,
        poolKeys,
        inputMint: new PublicKey(inputMint),
        amountIn,
        amountOutMin,
        // optional controls (leave undefined unless we start sourcing them from compute response)
        priceLimit: undefined,
        observationId: poolInfo?.observationId ?? new PublicKey(poolKeys?.observationId),
        remainingAccounts,

        config: { bypassAssociatedCheck: false, checkCreateATAOwner: false, associatedOnly: true },
        computeBudgetConfig: await ray.utils1216.getComputeBudgetConfig?.(),
        txTipConfig: undefined,
        txVersion: txv,
        feePayer: owner.publicKey,
        ownerInfo: { useSOLBalance: useSOLBalanceIn, feePayer: owner.publicKey },
      });
      const { txId } = await execute({ skipPreflight: false, sendAndConfirm: true });
      return [txId];
    }

    const { execute } = await ray.cpmm.swap({
      poolInfo,
      poolKeys,
      baseIn: true,
      inputAmount: new BN(String(amountLamports)),
      slippage,
      ownerInfo: { useSOLBalance: useSOLBalanceIn, feePayer: owner.publicKey },
      computeBudgetConfig: await ray.utils1216.getComputeBudgetConfig?.(),
      txTipConfig: undefined,
      txVersion: txv,
      feePayer: owner.publicKey,
    });

    const { txId } = await execute({ skipPreflight: false, sendAndConfirm: true });
    return [txId];
  }

  throw new Error(`failed to execute swap after ${maxAttempts} attempts`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rpcUrl = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const walletPath = process.env.SWAP_WALLET;
  const inputMint = process.env.INPUT_MINT || WSOL;
  const outputMint = process.env.OUTPUT_MINT;
  const amount = Number(process.env.AMOUNT_LAMPORTS || 5_000_000);
  const slippageBps = Number(process.env.SLIPPAGE_BPS || 100);
  const txVersion = process.env.TX_VERSION || 'V0';

  if (!walletPath || !outputMint) throw new Error('Set SWAP_WALLET and OUTPUT_MINT');

  const sigs = await runSdkSwap({
    rpcUrl,
    walletPath,
    inputMint,
    outputMint,
    amountLamports: amount,
    slippageBps,
    txVersion,
  });

  console.log('TX IDs:', sigs);
}
