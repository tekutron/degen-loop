#!/usr/bin/env node
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import fs from 'node:fs';

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const WALLET_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';

async function checkBalance() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  // Get SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  const solBalanceFormatted = solBalance / 1e9;
  
  console.log('Wallet:', wallet.publicKey.toString());
  console.log('SOL Balance:', solBalanceFormatted.toFixed(4), 'SOL');
  
  // Get token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );
  
  console.log('\nToken Positions:');
  if (tokenAccounts.value.length === 0) {
    console.log('  None');
  } else {
    for (const account of tokenAccounts.value) {
      const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
      const mint = account.account.data.parsed.info.mint;
      if (amount > 0) {
        console.log(`  ${mint}: ${amount}`);
      }
    }
  }
  
  return { solBalance: solBalanceFormatted, tokenAccounts: tokenAccounts.value.length };
}

checkBalance().catch(console.error);
