#!/usr/bin/env node
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import fs from 'node:fs';

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const WALLET_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';
const TOKEN_MINT = process.argv[2] || 'HTCiQqiJa4e2L7aB5heTVgb2FYJyWDr6XdgsHwr3MpLR';

async function checkTokenAccount() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  console.log('Wallet:', wallet.publicKey.toString());
  console.log('Token Mint:', TOKEN_MINT);
  
  const ata = await getAssociatedTokenAddress(
    new PublicKey(TOKEN_MINT),
    wallet.publicKey
  );
  
  console.log('Token Account:', ata.toString());
  
  try {
    const accountInfo = await getAccount(connection, ata);
    
    console.log('\nAccount Details:');
    console.log('  Amount:', accountInfo.amount.toString());
    console.log('  Decimals:', accountInfo.mint);
    console.log('  Is Frozen:', accountInfo.isFrozen);
    console.log('  Delegate:', accountInfo.delegate?.toString() || 'None');
    console.log('  Delegated Amount:', accountInfo.delegatedAmount?.toString() || '0');
    console.log('  Close Authority:', accountInfo.closeAuthority?.toString() || 'None');
    
    if (accountInfo.isFrozen) {
      console.log('\n⚠️  Account is FROZEN - cannot transfer!');
    }
    
    if (accountInfo.delegate) {
      console.log('\n⚠️  Account has DELEGATION - delegated amount:', accountInfo.delegatedAmount.toString());
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkTokenAccount().catch(console.error);
