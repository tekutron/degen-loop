#!/usr/bin/env node
import fetch from 'node-fetch';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import fs from 'fs';

const WALLET_PATH = '../wallets/doge_trader_keypair.json';
const JUPITER_KEY = '1f76dcbd-dc35-4766-a29e-d81e2b31a7a8';
const MIN_SPREAD = 1.5; // 1.5% minimum profit

const TOKENS = [
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'POPCAT', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' }
];

let scans = 0;

async function executeArbitrage(arb) {
  console.log(`\n💰 EXECUTING ARBITRAGE:\n`);
  console.log(`Token: ${arb.token}`);
  console.log(`Spread: ${arb.spread}%`);
  console.log(`Direction: ${arb.direction}\n`);
  
  try {
    const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH))));
    
    // Execute trade via Jupiter (handles best route)
    const amount = 10000000; // 0.01 SOL test
    
    const params = new URLSearchParams({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: arb.mint,
      amount: amount.toString(),
      taker: wallet.publicKey.toString(),
      priorityFee: '100000',
      slippageBps: '100'
    });
    
    const ord = await fetch(`https://lite-api.jup.ag/ultra/v1/order?${params}`, {
      headers: { 'X-API-KEY': JUPITER_KEY }
    });
    
    const order = await ord.json();
    
    if (order.errorCode) {
      console.log(`❌ Quote failed: ${order.errorMessage}`);
      return false;
    }
    
    console.log(`✅ Got quote - executing...`);
    
    const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));
    tx.sign([wallet]);
    
    const exe = await fetch('https://lite-api.jup.ag/ultra/v1/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': JUPITER_KEY },
      body: JSON.stringify({
        signedTransaction: Buffer.from(tx.serialize()).toString('base64'),
        requestId: order.requestId
      })
    });
    
    const res = await exe.json();
    
    if (res.status === 'Success') {
      console.log(`\n🎉 ARBITRAGE EXECUTED!`);
      console.log(`TX: ${res.signature}`);
      console.log(`https://solscan.io/tx/${res.signature}\n`);
      return true;
    } else {
      console.log(`❌ Execute failed: ${res.error || 'Unknown'}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function checkArb(token) {
  try {
    const jupResp = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${token.mint}&amount=10000000&slippageBps=50`
    );
    const jupData = await jupResp.json();
    
    if (!jupData.outAmount) return null;
    
    const jupRate = parseInt(jupData.outAmount) / 10000000;
    
    // Compare with DexScreener price
    const dexResp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`);
    const dexData = await dexResp.json();
    
    const bestPair = dexData.pairs?.[0];
    if (!bestPair) return null;
    
    const dexRate = 1 / parseFloat(bestPair.priceNative);
    const spread = Math.abs(jupRate - dexRate) / Math.min(jupRate, dexRate) * 100;
    
    if (spread > MIN_SPREAD) {
      return {
        token: token.symbol,
        mint: token.mint,
        spread: spread.toFixed(2),
        jupRate,
        dexRate
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

async function monitor() {
  scans++;
  console.log(`[${scans}] Scanning ${TOKENS.length} tokens...`);
  
  for (const token of TOKENS) {
    const arb = await checkArb(token);
    
    if (arb) {
      console.log(`\n🚨 ARBITRAGE: ${arb.token} - ${arb.spread}% spread`);
      
      // EXECUTE
      const success = await executeArbitrage(arb);
      
      if (success) {
        console.log(`\n✅ MEV BOT WIN - Mission complete!`);
        process.exit(0);
      }
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
}

console.log('🤖 MEV Arbitrage Bot Started\n');
console.log(`Watching: ${TOKENS.map(t => t.symbol).join(', ')}`);
console.log(`Min spread: ${MIN_SPREAD}%\n`);

setInterval(monitor, 10000); // Every 10s
monitor();
