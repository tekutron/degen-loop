#!/usr/bin/env node
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';

const rpc = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const connection = new Connection(rpc, 'confirmed');
const kp = JSON.parse(fs.readFileSync('wallets/generated_keypair.json', 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(kp));

console.log('Wallet:', keypair.publicKey.toString());
console.log('Fetching all token accounts via RPC...\n');

// Get all token accounts using Token Program
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const accounts = await connection.getParsedTokenAccountsByOwner(
  keypair.publicKey,
  { programId: TOKEN_PROGRAM_ID }
);

console.log(`Found ${accounts.value.length} token accounts\n`);

let hasBalances = false;

for (const { pubkey, account } of accounts.value) {
  const parsed = account.data.parsed.info;
  const mint = parsed.mint;
  const amount = parsed.tokenAmount.uiAmount;
  const rawAmount = parsed.tokenAmount.amount;
  
  if (amount > 0) {
    hasBalances = true;
    console.log('✅ TOKEN FOUND:');
    console.log(`   Token Account: ${pubkey.toString()}`);
    console.log(`   Mint: ${mint}`);
    console.log(`   Amount: ${amount}`);
    console.log(`   Raw: ${rawAmount}`);
    console.log('');
  }
}

if (!hasBalances) {
  console.log('No tokens with balance found.');
}

// Also check SOL balance
const solBalance = await connection.getBalance(keypair.publicKey);
console.log('\nSOL Balance:', (solBalance / 1e9).toFixed(4), 'SOL');
