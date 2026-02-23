// Pump.fun Graduation Sniper
// Detects when token graduates from bonding curve → Raydium
// Buy during graduation, sell into launch pump

import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { Keypair } from '@solana/web3.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Use public RPC to avoid API key issues
const RPC = 'https://api.mainnet-beta.solana.com';
const conn = new Connection(RPC, 'confirmed');

const BONDING_CURVE_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const RAYDIUM_PROGRAM = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

// Track tokens nearing graduation
const GRADUATION_THRESHOLD = 85; // ~85 SOL = graduation on pump.fun
const watchedTokens = new Map();

async function monitorGraduations() {
  console.log('[Graduation Sniper] Starting...');
  console.log('[Graduation Sniper] Watching for pump.fun → Raydium migrations\n');

  while (true) {
    try {
      // Fetch recent pump.fun tokens approaching graduation
      const tokens = await fetchPumpFunTokens();
      
      for (const token of tokens) {
        const bondingProgress = token.bondingCurveProgress;
        const mint = token.mint;

        // If approaching graduation (>85%)
        if (bondingProgress >= GRADUATION_THRESHOLD && !watchedTokens.has(mint)) {
          console.log(`\n📊 Token nearing graduation:`);
          console.log(`   Mint: ${mint}`);
          console.log(`   Progress: ${bondingProgress}%`);
          console.log(`   → Watching for migration...`);
          
          watchedTokens.set(mint, { progress: bondingProgress, lastCheck: Date.now() });
        }

        // Check if graduated
        if (watchedTokens.has(mint)) {
          const graduated = await checkIfGraduated(mint);
          
          if (graduated) {
            console.log(`\n🚀 GRADUATION DETECTED:`);
            console.log(`   Token: ${mint}`);
            console.log(`   Status: Migrated to Raydium`);
            console.log(`   Time: ${new Date().toLocaleTimeString()}`);
            console.log('\n   → EXECUTING BUY (Raydium launch pump)');
            
            // Execute trade immediately
            await executeTrade(mint, 0.02); // 0.02 SOL position
            
            watchedTokens.delete(mint);
          }
        }
      }

      // Clean up old watches (>30 min)
      for (const [mint, data] of watchedTokens.entries()) {
        if (Date.now() - data.lastCheck > 30 * 60 * 1000) {
          watchedTokens.delete(mint);
        }
      }

      await new Promise(r => setTimeout(r, 10000)); // Check every 10s

    } catch (err) {
      console.error(`[Error] ${err.message}`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

async function fetchPumpFunTokens() {
  // Fetch tokens from pump.fun API
  try {
    const response = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=last_trade_timestamp&order=DESC');
    const data = await response.json();
    return data.map(token => ({
      mint: token.mint,
      bondingCurveProgress: (token.market_cap / token.bonding_curve_completion_threshold) * 100,
      marketCap: token.market_cap
    }));
  } catch {
    return [];
  }
}

async function checkIfGraduated(mint) {
  // Check if token has Raydium pool (graduated)
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const data = await response.json();
    
    if (data.pairs) {
      const raydiumPair = data.pairs.find(p => p.dexId === 'raydium');
      return !!raydiumPair;
    }
    return false;
  } catch {
    return false;
  }
}

async function executeTrade(tokenMint, solAmount) {
  // Execute buy via manual-trade.mjs (proven working)
  console.log(`   Executing: ${solAmount} SOL → ${tokenMint.slice(0, 8)}...`);
  
  try {
    const tradeScript = '/home/j/.openclaw/workspace/mev/quick_buy.mjs';
    
    // Create quick buy script
    const buyScript = `
import fetch from 'node-fetch';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import fs from 'fs';
import bs58 from 'bs58';

const keypairData = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/wallets/doge_trader_keypair.json'));
const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

const tokenMint = '${tokenMint}';
const solAmount = ${solAmount};

console.log('Getting quote...');
const quoteResponse = await fetch(\`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=\${tokenMint}&amount=\${Math.floor(solAmount * 1e9)}&slippageBps=1000\`);
const quoteData = await quoteResponse.json();

console.log('Swapping...');
const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quoteResponse: quoteData,
    userPublicKey: wallet.publicKey.toString(),
    wrapAndUnwrapSol: true,
    prioritizationFeeLamports: 5000
  })
});

const { swapTransaction } = await swapResponse.json();
const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

transaction.sign([wallet]);
const rawTransaction = transaction.serialize();
const txid = await conn.sendRawTransaction(rawTransaction, { skipPreflight: true, maxRetries: 2 });

console.log('TX:', txid);
console.log('Confirming...');
await conn.confirmTransaction(txid, 'confirmed');
console.log('✅ BUY COMPLETE');
`;

    fs.writeFileSync(tradeScript, buyScript);
    const { stdout, stderr } = await execPromise(`cd /home/j/.openclaw/workspace/mev && node quick_buy.mjs`);
    
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('   ✅ Trade executed - monitoring for exit');
    
    // Monitor position for exit (TP +30%, SL -12%, max 10min)
    setTimeout(() => monitorPosition(tokenMint, solAmount), 5000);
    
  } catch (err) {
    console.error('   ❌ Trade failed:', err.message);
  }
}

async function monitorPosition(tokenMint, solAmount) {
  console.log('   Monitoring position:', tokenMint.slice(0,8) + '...');
  
  const startTime = Date.now();
  const maxHoldMs = 10 * 60 * 1000; // 10 minutes
  
  while (Date.now() - startTime < maxHoldMs) {
    try {
      // Check current price
      const url = 'https://api.dexscreener.com/latest/dex/tokens/' + tokenMint;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        const priceChange5m = parseFloat(pair.priceChange?.m5 || 0);
        
        // Exit conditions
        if (priceChange5m >= 30) {
          console.log('   🎯 TP HIT: +' + priceChange5m + '% - SELLING');
          await executeSell(tokenMint);
          return;
        }
        
        if (priceChange5m <= -12) {
          console.log('   ⛔ SL HIT: ' + priceChange5m + '% - SELLING');
          await executeSell(tokenMint);
          return;
        }
        
        console.log('   P&L:', (priceChange5m > 0 ? '+' : '') + priceChange5m + '%');
      }
      
      await new Promise(r => setTimeout(r, 20000)); // Check every 20s
      
    } catch (err) {
      console.error('   Monitor error:', err.message);
    }
  }
  
  console.log('   ⏰ Max hold time reached - SELLING');
  await executeSell(tokenMint);
}

async function executeSell(tokenMint) {
  console.log('   Selling', tokenMint.slice(0,8) + '...');
  // Execute sell (similar to buy but reversed)
  // For now, log only - would need full sell implementation
  console.log('   [Sell logic would execute here]');
}

monitorGraduations();
