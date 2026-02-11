#!/usr/bin/env node
import { Connection, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import { execSync } from 'child_process';

const rpc = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const connection = new Connection(rpc, 'confirmed');

const kp = JSON.parse(fs.readFileSync('wallets/generated_keypair.json', 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(kp));
const walletAddress = keypair.publicKey;

console.log('Wallet:', walletAddress.toString());
console.log('Checking for token holdings...\n');

const WSOL = 'So11111111111111111111111111111111111111112';

const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  walletAddress,
  { programId: TOKEN_PROGRAM_ID }
);

let sold = 0;
for (const { account, pubkey } of tokenAccounts.value) {
  const { mint, tokenAmount } = account.data.parsed.info;
  
  if (mint === WSOL) continue; // Skip wSOL
  if (tokenAmount.uiAmount <= 0) continue; // Skip empty
  
  console.log(`💰 Found: ${mint}`);
  console.log(`   Amount: ${tokenAmount.uiAmount} (${tokenAmount.amount} raw)`);
  console.log(`   Selling...`);
  
  try {
    const result = execSync(
      `SOLANA_RPC=${rpc} SWAP_WALLET=wallets/generated_keypair.json INPUT_MINT=${mint} OUTPUT_MINT=${WSOL} AMOUNT_LAMPORTS=${tokenAmount.amount} SLIPPAGE_BPS=300 TX_VERSION=V0 MAIN_WALLET=1 node sdkSwap.mjs`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    console.log(`   ✅ Sold! TX: ${result.trim()}`);
    sold++;
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }
  console.log('');
}

if (sold === 0) {
  console.log('✅ No tokens to sell - wallet is clean!');
} else {
  console.log(`✅ Sold ${sold} token(s)`);
}
