#!/usr/bin/env node
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';

const rpc = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const connection = new Connection(rpc, 'confirmed');
const kp = JSON.parse(fs.readFileSync('wallets/generated_keypair.json', 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(kp));

console.log('Wallet:', keypair.publicKey.toString());
console.log('\n=== Checking Standard Token Program ===\n');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const standardTokens = await connection.getParsedTokenAccountsByOwner(
  keypair.publicKey,
  { programId: TOKEN_PROGRAM_ID }
);

console.log(`Found ${standardTokens.value.length} standard token accounts`);
for (const { pubkey, account } of standardTokens.value) {
  const parsed = account.data.parsed.info;
  if (parsed.tokenAmount.uiAmount > 0) {
    console.log(`  ${parsed.mint}: ${parsed.tokenAmount.uiAmount}`);
  }
}

console.log('\n=== Checking Token-2022 Program ===\n');

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
try {
  const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
    keypair.publicKey,
    { programId: TOKEN_2022_PROGRAM_ID }
  );
  
  console.log(`Found ${token2022Accounts.value.length} Token-2022 accounts`);
  for (const { pubkey, account } of token2022Accounts.value) {
    const parsed = account.data.parsed.info;
    if (parsed.tokenAmount.uiAmount > 0) {
      console.log(`  ✅ ${parsed.mint}: ${parsed.tokenAmount.uiAmount}`);
      console.log(`     Token Account: ${pubkey.toString()}`);
    }
  }
} catch (err) {
  console.log('Error checking Token-2022:', err.message);
}

// Check SOL
const solBalance = await connection.getBalance(keypair.publicKey);
console.log('\nSOL Balance:', (solBalance / 1e9).toFixed(4), 'SOL');
