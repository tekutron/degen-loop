#!/usr/bin/env node
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createCloseAccountInstruction, TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token';
import fs from 'node:fs';

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const WALLET_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';

async function unwrapSOL() {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    
    console.log('Wallet:', wallet.publicKey.toString());
    
    // Get the wrapped SOL token account
    const wsolAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      wallet.publicKey
    );
    
    console.log('Wrapped SOL account:', wsolAccount.toString());
    
    // Check balance
    const accountInfo = await connection.getTokenAccountBalance(wsolAccount);
    console.log('Wrapped SOL balance:', accountInfo.value.uiAmount, 'SOL');
    
    if (accountInfo.value.uiAmount === 0) {
      console.log('No wrapped SOL to unwrap');
      return;
    }
    
    // Close the account to unwrap
    console.log('Closing wrapped SOL account to unwrap...');
    const transaction = new Transaction().add(
      createCloseAccountInstruction(
        wsolAccount,
        wallet.publicKey,
        wallet.publicKey,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ Unwrapped! Signature:', signature);
    
    // Check final balance
    const finalBalance = await connection.getBalance(wallet.publicKey);
    console.log('Final SOL balance:', (finalBalance / 1e9).toFixed(4), 'SOL');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

unwrapSOL();
