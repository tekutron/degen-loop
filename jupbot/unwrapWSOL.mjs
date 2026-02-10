#!/usr/bin/env node
/**
 * unwrapWSOL.mjs
 * Unwraps wSOL back to native SOL by closing the wSOL token account
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, closeAccount } from '@solana/spl-token';
import fs from 'fs';

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

async function unwrapWSOL() {
  console.log('🔓 Unwrapping wSOL to native SOL...\n');

  const rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  const kp = JSON.parse(fs.readFileSync('wallets/generated_keypair.json', 'utf8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(kp));
  const publicKey = keypair.publicKey;
  
  console.log(`Wallet: ${publicKey.toBase58()}`);

  // Get wSOL token account
  const wsolAccount = await getAssociatedTokenAddress(
    WSOL_MINT,
    publicKey
  );

  console.log(`wSOL Account: ${wsolAccount.toBase58()}`);

  // Check if account exists and has balance
  try {
    const accountInfo = await connection.getTokenAccountBalance(wsolAccount);
    const balance = accountInfo.value.uiAmount;
    
    if (balance === 0) {
      console.log('❌ No wSOL balance to unwrap');
      return;
    }
    
    console.log(`wSOL Balance: ${balance} wSOL`);
    console.log('\n🔄 Closing wSOL account to unwrap...');
    
    // Close the account - this automatically unwraps wSOL to native SOL
    const signature = await closeAccount(
      connection,
      keypair,
      wsolAccount,
      publicKey,
      keypair
    );
    
    console.log(`✅ Unwrapped! Transaction: ${signature}`);
    console.log(`   https://solscan.io/tx/${signature}`);
    
    // Wait a moment and show new balance
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBalance = await connection.getBalance(publicKey);
    console.log(`\n💰 New SOL Balance: ${newBalance / 1e9} SOL`);
    
  } catch (error) {
    if (error.message?.includes('could not find account')) {
      console.log('❌ No wSOL account found');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
}

unwrapWSOL()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
