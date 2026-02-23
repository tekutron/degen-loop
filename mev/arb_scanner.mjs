#!/usr/bin/env node
/**
 * Cross-DEX Arbitrage Scanner
 * Find profitable price differences across Solana DEXs
 */

import fetch from 'node-fetch';

const TOKENS_TO_WATCH = [
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }
];

async function checkArbitrage(token) {
  try {
    // Get Jupiter price (aggregates best route)
    const jupQuote = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${token.mint}&amount=100000000&slippageBps=50`
    );
    const jupData = await jupQuote.json();
    const jupPrice = jupData.outAmount ? (100000000 / parseInt(jupData.outAmount)) : 0;
    
    // Get Raydium price via DexScreener
    const dexResp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`);
    const dexData = await dexResp.json();
    const raydiumPair = dexData.pairs?.find(p => p.dexId === 'raydium');
    const raydiumPrice = raydiumPair ? parseFloat(raydiumPair.priceNative) : 0;
    
    if (!jupPrice || !raydiumPrice) return null;
    
    // Calculate spread
    const spread = Math.abs(jupPrice - raydiumPrice) / Math.min(jupPrice, raydiumPrice) * 100;
    
    // Profitable if spread > 2% (covers fees + profit)
    if (spread > 2) {
      const direction = jupPrice < raydiumPrice ? 'Jupiter→Raydium' : 'Raydium→Jupiter';
      
      return {
        token: token.symbol,
        mint: token.mint,
        jupPrice,
        raydiumPrice,
        spread: spread.toFixed(2),
        direction,
        profit: `~${(spread - 1).toFixed(2)}%` // Minus 1% for fees
      };
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

async function scan() {
  console.log(`\n[${new Date().toLocaleTimeString()}] 🔍 Scanning for arbitrage...\n`);
  
  for (const token of TOKENS_TO_WATCH) {
    const arb = await checkArbitrage(token);
    
    if (arb) {
      console.log(`🚨 ARBITRAGE FOUND!`);
      console.log(`Token: ${arb.token}`);
      console.log(`Spread: ${arb.spread}%`);
      console.log(`Direction: ${arb.direction}`);
      console.log(`Est. Profit: ${arb.profit}`);
      console.log(`Mint: ${arb.mint}\n`);
      
      // Return for execution
      return arb;
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('No arbitrage opportunities found.\n');
  return null;
}

// Run scan
scan();
