#!/usr/bin/env node
/**
 * Safe Jupiter-only swap - bypasses Raydium SDK issues
 * Usage: node safeSwap.mjs <inputMint> <outputMint> <amountLamports> [slippageBps]
 */
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import fs from 'fs';

const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',   // USD1
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',   // USDH
]);

const [,, inputMint, outputMint, amount, slippage = '150'] = process.argv;

if (!inputMint || !outputMint || !amount) {
  console.error('Usage: node safeSwap.mjs <inputMint> <outputMint> <amount> [slippageBps]');
  process.exit(1);
}

// Block stablecoin targets (unless we're selling one)
const WSOL = 'So11111111111111111111111111111111111111112';
if (STABLECOINS.has(outputMint) && inputMint === WSOL) {
  console.error('❌ Cannot buy stablecoins');
  process.exit(1);
}

const rpc = process.env.SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const walletPath = process.env.SWAP_WALLET || 'wallets/generated_keypair.json';

const conn = new Connection(rpc, 'confirmed');
const kp = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(kp));

console.log(`Swapping ${amount} lamports: ${inputMint.slice(0,8)}... → ${outputMint.slice(0,8)}...`);

try {
  // Use Jupiter Ultra API with API key
  const apiKey = process.env.JUPITER_API_KEY || '1f76dcbd-dc35-4766-a29e-d81e2b31a7a8';
  const ultraUrl = 'https://api.jup.ag/ultra/v1/order';
  const ultraBody = {
    inputMint,
    outputMint,
    amount,
    slippageBps: parseInt(slippage),
    taker: keypair.publicKey.toString(),
    prioritizationFeeLamports: '100000',
    wrapAndUnwrapSol: true
  };
  
  console.log('Calling Jupiter Ultra...');
  const ultraRes = await fetch(ultraUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify(ultraBody)
  });
  
  if (!ultraRes.ok) {
    const errText = await ultraRes.text();
    throw new Error(`Jupiter Ultra failed: ${ultraRes.status} - ${errText}`);
  }
  
  const ultraData = await ultraRes.json();
  
  if (!ultraData.swapTransaction) {
    throw new Error(`No swap transaction returned: ${JSON.stringify(ultraData)}`);
  }
  
  console.log(`Output: ${ultraData.outAmount || 'unknown'}`);
  
  const { swapTransaction } = ultraData;
  
  // Sign and send
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  tx.sign([keypair]);
  
  console.log('Sending transaction...');
  const sig = await conn.sendTransaction(tx, { maxRetries: 3 });
  console.log('TX:', sig);
  
  console.log('Confirming...');
  await conn.confirmTransaction(sig, 'confirmed');
  console.log('✅ Confirmed!');
  
} catch (error) {
  console.error('❌ Swap failed:', error.message);
  process.exit(1);
}
