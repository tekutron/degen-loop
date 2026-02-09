// unwrapSol.mjs - Unwrap wSOL to native SOL for transaction fees

import fs from 'node:fs';
import path from 'node:path';
import { 
  Connection, 
  Keypair, 
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { 
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

async function main() {
  const rpcUrl = process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const walletPath = process.env.SWAP_WALLET || path.join(HERE, 'wallets', 'generated_keypair.json');
  
  console.log('Loading wallet:', walletPath);
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');
  
  console.log('Wallet:', keypair.publicKey.toBase58());
  
  // Get wSOL token account
  const wsolAccount = await getAssociatedTokenAddress(
    WSOL_MINT,
    keypair.publicKey
  );
  
  console.log('wSOL account:', wsolAccount.toBase58());
  
  // Check balance
  const balance = await connection.getTokenAccountBalance(wsolAccount);
  console.log('wSOL balance:', balance.value.uiAmount);
  
  if (!balance.value.uiAmount || balance.value.uiAmount === 0) {
    console.log('❌ No wSOL to unwrap');
    return;
  }
  
  // Close wSOL account (unwraps to native SOL)
  console.log('Unwrapping wSOL → native SOL...');
  
  const tx = new Transaction().add(
    createCloseAccountInstruction(
      wsolAccount,
      keypair.publicKey,
      keypair.publicKey,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [keypair],
    { commitment: 'confirmed' }
  );
  
  console.log('✅ Unwrapped!');
  console.log('Signature:', sig);
  console.log('Explorer:', `https://solscan.io/tx/${sig}`);
  
  // Check new balances
  const newSolBalance = await connection.getBalance(keypair.publicKey);
  console.log('');
  console.log('New native SOL balance:', newSolBalance / 1e9);
}

main().catch(console.error);
