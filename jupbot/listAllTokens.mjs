#!/usr/bin/env node
import { Connection, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

const rpc = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const connection = new Connection(rpc, 'confirmed');
const kp = JSON.parse(fs.readFileSync('wallets/generated_keypair.json', 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(kp));

const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  keypair.publicKey,
  { programId: TOKEN_PROGRAM_ID }
);

console.log('Wallet:', keypair.publicKey.toString());
console.log('\nAll token accounts:\n');

for (const { pubkey, account } of tokenAccounts.value) {
  const { mint, tokenAmount } = account.data.parsed.info;
  console.log('Token Account:', pubkey.toString());
  console.log('  Mint:', mint);
  console.log('  Amount:', tokenAmount.uiAmount);
  console.log('  Raw:', tokenAmount.amount);
  console.log('');
}
