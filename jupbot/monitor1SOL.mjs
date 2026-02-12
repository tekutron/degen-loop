#!/usr/bin/env node
/**
 * monitor1SOL.mjs - Monitor balance until we hit 1 SOL
 * Reports back via memory file when goal is reached
 */
import { Connection, Keypair } from '@solana/web3.js';
import fs from 'node:fs';
import path from 'node:path';

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492';
const WALLET_PATH = '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json';
const MEMORY_DIR = '/home/j/.openclaw/workspace/memory';
const STATUS_FILE = path.join(MEMORY_DIR, 'trading-1sol-status.json');

const TARGET_SOL = 1.0;
const CHECK_INTERVAL_MS = 60000; // Check every minute

async function checkBalance() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  const solBalance = await connection.getBalance(wallet.publicKey);
  const solBalanceFormatted = solBalance / 1e9;
  
  return solBalanceFormatted;
}

async function monitor() {
  console.log('🎯 Starting 1 SOL Challenge Monitor');
  console.log(`   Target: ${TARGET_SOL} SOL`);
  console.log(`   Checking every ${CHECK_INTERVAL_MS / 1000}s\n`);
  
  const startBalance = await checkBalance();
  console.log(`Starting balance: ${startBalance.toFixed(4)} SOL\n`);
  
  // Save initial status
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({
    startTime: new Date().toISOString(),
    startBalance,
    targetSOL: TARGET_SOL,
    reached: false,
    lastCheck: new Date().toISOString(),
    currentBalance: startBalance,
  }, null, 2));
  
  while (true) {
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    
    try {
      const currentBalance = await checkBalance();
      const progress = ((currentBalance / TARGET_SOL) * 100).toFixed(1);
      const gainPct = (((currentBalance - startBalance) / startBalance) * 100).toFixed(2);
      
      console.log(`[${new Date().toLocaleTimeString()}] Balance: ${currentBalance.toFixed(4)} SOL (${progress}% to target, ${gainPct >= 0 ? '+' : ''}${gainPct}%)`);
      
      // Update status file
      const status = {
        startTime: JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')).startTime,
        startBalance,
        targetSOL: TARGET_SOL,
        reached: currentBalance >= TARGET_SOL,
        lastCheck: new Date().toISOString(),
        currentBalance,
        progress: parseFloat(progress),
        gainPct: parseFloat(gainPct),
      };
      
      if (currentBalance >= TARGET_SOL) {
        status.reachedTime = new Date().toISOString();
        const duration = (new Date(status.reachedTime) - new Date(status.startTime)) / 1000 / 60; // minutes
        status.durationMinutes = Math.round(duration);
        
        console.log('\n🎉 TARGET REACHED!');
        console.log(`   Final: ${currentBalance.toFixed(4)} SOL`);
        console.log(`   Gain: +${gainPct}%`);
        console.log(`   Duration: ${Math.floor(duration / 60)}h ${Math.round(duration % 60)}m`);
      }
      
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
      
      if (status.reached) {
        console.log('\n✅ Goal complete - exiting monitor');
        process.exit(0);
      }
      
    } catch (err) {
      console.error('❌ Check failed:', err.message);
    }
  }
}

monitor().catch(console.error);
