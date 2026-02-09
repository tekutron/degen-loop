#!/usr/bin/env node
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

const rpc = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(rpc, 'confirmed');

const kp = JSON.parse(fs.readFileSync('wallets/generated_keypair.json', 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(kp));
const walletAddress = keypair.publicKey;

console.log('Wallet:', walletAddress.toString());

// Get SOL balance
const solBalance = await connection.getBalance(walletAddress);
console.log('SOL Balance:', solBalance / LAMPORTS_PER_SOL, 'SOL');

// Get token accounts
const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  walletAddress,
  { programId: TOKEN_PROGRAM_ID }
);

console.log('\nToken Accounts:');
for (const { account, pubkey } of tokenAccounts.value) {
  const { mint, tokenAmount } = account.data.parsed.info;
  if (tokenAmount.uiAmount > 0) {
    console.log(`  ${mint}`);
    console.log(`    Amount: ${tokenAmount.uiAmount} (${tokenAmount.amount} raw)`);
    console.log(`    Account: ${pubkey.toString()}`);
  }
}
