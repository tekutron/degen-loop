#!/usr/bin/env node
/**
 * scalpMooNut.mjs - Scalp MooNutPeng based on 30s candle patterns
 * Strategy: 1% SL, 5% TP, constant monitoring, quick entries/exits
 */

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Connection, Keypair } from '@solana/web3.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const WSOL = 'So11111111111111111111111111111111111111112';

// MooNutPeng
const TOKEN_MINT = '84hqMeGHxqegpvf4kGaRp38iVd145DSoEBwnmBTtpump';
const TOKEN_SYMBOL = 'MooNutPeng';

// Scalping params
const POSITION_SIZE_SOL = 0.08;  // ~17% of capital
const TAKE_PROFIT_PCT = 5;        // 5% profit
const STOP_LOSS_PCT = 1;          // 1% loss
const POLL_INTERVAL_MS = 10000;   // 10 seconds (for tight monitoring)
const SLIPPAGE_BPS = 1000;        // 10% slippage

// Entry signals (based on candle patterns)
const MIN_VOLUME_SPIKE = 1.5;     // 5min vol must be 1.5x 1h average
const MIN_MOMENTUM = 0.5;         // Must be moving up at least 0.5% in 5min
const MAX_SPREAD = 2;             // Don't enter if 1min-5min spread > 2% (choppy)

async function sumTokenRaw(connection, owner, mint) {
  const TOKEN_PROGRAM_ID = new (await import('@solana/web3.js')).PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const TOKEN_2022_PROGRAM_ID = new (await import('@solana/web3.js')).PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
  
  let total = 0n;
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(owner, { programId });
      for (const { account } of accounts.value) {
        const parsed = account.data.parsed.info;
        if (parsed.mint === mint) {
          total += BigInt(parsed.tokenAmount.amount);
        }
      }
    } catch {}
  }
  return total;
}

async function execNode(file, env) {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    const p = spawn('node', [file], { cwd: HERE, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => {
      if (code === 0) return resolve({ out, err });
      reject(new Error(`Command failed (${code})`));
    });
  });
}

function extractSig(stdout) {
  const m = stdout.match(/\b[1-9A-HJ-NP-Za-km-z]{80,120}\b/);
  return m ? m[0] : '';
}

async function getPrice() {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_MINT}`;
    const res = await fetch(url);
    const json = await res.json();
    const pairs = json?.pairs?.filter(p => p?.chainId === 'solana') || [];
    pairs.sort((a, b) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0));
    const p = pairs[0];
    
    if (!p) throw new Error('No pair data');
    
    return {
      price: Number(p.priceUsd || 0),
      m1: Number(p.priceChange?.m1 || 0),
      m5: Number(p.priceChange?.m5 || 0),
      vol5m: Number(p.volume?.m5 || 0),
      vol1h: Number(p.volume?.h1 || 0),
      txns5m: (Number(p.txns?.m5?.buys || 0) + Number(p.txns?.m5?.sells || 0))
    };
  } catch (err) {
    throw new Error(`Price fetch failed: ${err.message}`);
  }
}

async function main() {
  if (process.env.MAIN_WALLET !== '1') {
    throw new Error('Set MAIN_WALLET=1 to confirm');
  }
  
  const rpcUrl = process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC;
  const walletPath = process.env.SWAP_WALLET || path.join(HERE, 'wallets', 'generated_keypair.json');
  
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');
  
  console.log('🎯 SCALPING MODE: MooNutPeng');
  console.log(`   Strategy: 1% SL / 5% TP`);
  console.log(`   Position: ${POSITION_SIZE_SOL} SOL`);
  console.log(`   Monitoring: Every 10 seconds\n`);
  
  let inPosition = false;
  let entryPrice = 0;
  let tpPrice = 0;
  let slPrice = 0;
  let entryTime = 0;
  
  while (true) {
    await sleep(POLL_INTERVAL_MS);
    
    try {
      const data = await getPrice();
      const now = Date.now();
      
      if (!inPosition) {
        // LOOK FOR ENTRY
        const volRatio = data.vol1h > 0 ? (data.vol5m / (data.vol1h / 12)) : 0;
        const spread = Math.abs(data.m1 - data.m5);
        
        console.log(`[${new Date().toLocaleTimeString()}] SCANNING`);
        console.log(`   Price: $${data.price.toFixed(8)}`);
        console.log(`   5min: ${data.m5.toFixed(1)}% | 1min: ${data.m1.toFixed(1)}%`);
        console.log(`   Volume ratio: ${volRatio.toFixed(1)}x`);
        console.log(`   Spread: ${spread.toFixed(1)}%`);
        
        // Entry signal
        if (data.m5 >= MIN_MOMENTUM && volRatio >= MIN_VOLUME_SPIKE && spread <= MAX_SPREAD) {
          console.log(`\n✅ ENTRY SIGNAL!`);
          console.log(`   Reason: +${data.m5.toFixed(1)}% 5min momentum + ${volRatio.toFixed(1)}x volume spike`);
          
          // BUY
          const amountLamports = Math.floor(POSITION_SIZE_SOL * 1e9);
          const before = await sumTokenRaw(connection, kp.publicKey, TOKEN_MINT);
          
          console.log(`   Buying ${POSITION_SIZE_SOL} SOL...`);
          
          const buyEnv = {
            SOLANA_RPC: rpcUrl,
            SWAP_WALLET: walletPath,
            INPUT_MINT: WSOL,
            OUTPUT_MINT: TOKEN_MINT,
            AMOUNT_LAMPORTS: String(amountLamports),
            SLIPPAGE_BPS: String(SLIPPAGE_BPS),
            TX_VERSION: 'V0',
            MAIN_WALLET: '1'
          };
          
          try {
            const buyOut = await execNode('./sdkSwap.mjs', buyEnv);
            const buySig = extractSig(buyOut.out);
            
            const after = await sumTokenRaw(connection, kp.publicKey, TOKEN_MINT);
            const received = after - before;
            
            if (received > 0n) {
              entryPrice = data.price;
              tpPrice = entryPrice * (1 + TAKE_PROFIT_PCT / 100);
              slPrice = entryPrice * (1 - STOP_LOSS_PCT / 100);
              entryTime = now;
              inPosition = true;
              
              console.log(`   ✅ ENTERED at $${entryPrice.toFixed(8)}`);
              console.log(`   TP: $${tpPrice.toFixed(8)} (+5%)`);
              console.log(`   SL: $${slPrice.toFixed(8)} (-1%)`);
              console.log(`   Tokens: ${received.toString()}\n`);
            } else {
              console.log(`   ❌ Buy failed - no tokens received\n`);
            }
          } catch (err) {
            console.log(`   ❌ Buy failed: ${err.message}\n`);
          }
        } else {
          console.log(`   ⏸️  No entry signal\n`);
        }
        
      } else {
        // IN POSITION - CHECK EXIT
        const pnl = ((data.price - entryPrice) / entryPrice) * 100;
        const holdTime = ((now - entryTime) / 1000 / 60).toFixed(1);
        
        console.log(`[${new Date().toLocaleTimeString()}] HOLDING`);
        console.log(`   Entry: $${entryPrice.toFixed(8)}`);
        console.log(`   Current: $${data.price.toFixed(8)}`);
        console.log(`   P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`);
        console.log(`   Hold time: ${holdTime} min`);
        
        let exitReason = '';
        
        if (data.price >= tpPrice) {
          exitReason = 'TP';
          console.log(`   🎯 TAKE PROFIT HIT (+5%)`);
        } else if (data.price <= slPrice) {
          exitReason = 'SL';
          console.log(`   🛑 STOP LOSS HIT (-1%)`);
        }
        
        if (exitReason) {
          // SELL
          const sellAmount = await sumTokenRaw(connection, kp.publicKey, TOKEN_MINT);
          
          if (sellAmount > 0n) {
            console.log(`   Selling...`);
            
            const sellEnv = {
              SOLANA_RPC: rpcUrl,
              SWAP_WALLET: walletPath,
              INPUT_MINT: TOKEN_MINT,
              OUTPUT_MINT: WSOL,
              AMOUNT_LAMPORTS: String(sellAmount),
              SLIPPAGE_BPS: String(SLIPPAGE_BPS),
              TX_VERSION: 'V0',
              MAIN_WALLET: '1'
            };
            
            try {
              const sellOut = await execNode('./sdkSwap.mjs', sellEnv);
              const sellSig = extractSig(sellOut.out);
              
              console.log(`   ✅ EXITED (${exitReason})`);
              console.log(`   Exit: $${data.price.toFixed(8)}`);
              console.log(`   P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%\n`);
              
              inPosition = false;
              
              // Brief pause before next trade
              console.log(`   ⏳ Waiting 30s before next scan...\n`);
              await sleep(30000);
            } catch (err) {
              console.log(`   ❌ Sell failed: ${err.message}\n`);
            }
          } else {
            console.log(`   ⚠️  No tokens to sell\n`);
            inPosition = false;
          }
        } else {
          console.log(`   ⏸️  Holding... (TP: ${((tpPrice - data.price) / data.price * 100).toFixed(2)}% away)\n`);
        }
      }
      
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
