#!/usr/bin/env node
/**
 * liquidateAll.mjs - Sell all token positions and consolidate to SOL
 */
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createCloseAccountInstruction } from '@solana/spl-token';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const WALLET_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

async function liquidateAll() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  console.log('🔍 Checking wallet:', wallet.publicKey.toString());
  
  // Get all token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );
  
  console.log(`\n📊 Found ${tokenAccounts.value.length} token accounts\n`);
  
  for (const account of tokenAccounts.value) {
    const info = account.account.data.parsed.info;
    const mint = info.mint;
    const amount = info.tokenAmount.uiAmount;
    const rawAmount = info.tokenAmount.amount;
    
    if (amount === 0) {
      console.log(`⏭️  Skipping ${mint} (balance: 0)`);
      continue;
    }
    
    console.log(`\n💰 Position: ${mint}`);
    console.log(`   Amount: ${amount}`);
    
    // Special case: wrapped SOL - just close the account to unwrap
    if (mint === WSOL_MINT) {
      console.log('   Type: Wrapped SOL');
      console.log('   Action: Closing account to unwrap...');
      try {
        // Use jup-trade.mjs which handles wSOL unwrapping
        const cmd = `node /home/j/.openclaw/workspace/jupbot/jup-trade.mjs sell ${mint} 100`;
        console.log(`   Running: ${cmd}`);
        const result = execSync(cmd, { encoding: 'utf8', cwd: '/home/j/.openclaw/workspace/jupbot' });
        console.log('   ✅ Unwrapped:', result);
      } catch (err) {
        console.error('   ❌ Failed:', err.message);
      }
      continue;
    }
    
    // Other tokens: sell via Jupiter
    console.log('   Action: Selling via Jupiter...');
    try {
      const cmd = `node /home/j/.openclaw/workspace/jupbot/jup-trade.mjs sell ${mint} 100`;
      console.log(`   Running: ${cmd}`);
      const result = execSync(cmd, { encoding: 'utf8', cwd: '/home/j/.openclaw/workspace/jupbot' });
      console.log('   ✅ Sold:', result);
      
      // Wait 2 seconds between trades
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error('   ❌ Failed to sell:', err.message);
    }
  }
  
  // Final balance check
  console.log('\n\n🎯 Final Balance Check:');
  const finalBalance = await connection.getBalance(wallet.publicKey);
  console.log(`   SOL: ${(finalBalance / 1e9).toFixed(4)}`);
  
  return finalBalance / 1e9;
}

liquidateAll().catch(console.error);
