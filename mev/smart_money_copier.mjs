// Smart Money Dashboard Copier
// Monitor GMGN.ai / Bullx "Smart Money" wallets and copy their trades

import { Connection, PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';

// Use public RPC to avoid API key issues
const RPC = 'https://api.mainnet-beta.solana.com';
const conn = new Connection(RPC, 'confirmed');

// Known profitable wallets (from GMGN.ai Smart Money section)
const SMART_WALLETS = [
  '7WaYL6nmLRzh5WZkGK5R8KxGYwz8sVdTmr8BptRyPump', // Example whale
  // Add more smart money wallets here from GMGN.ai
];

const copiedTrades = new Set(); // Prevent duplicate copies

async function monitorSmartMoney() {
  console.log('[Smart Money Copier] Starting...');
  console.log(`[Smart Money Copier] Monitoring ${SMART_WALLETS.length} wallets\n`);

  for (const wallet of SMART_WALLETS) {
    console.log(`   → ${wallet}`);
  }
  console.log('');

  while (true) {
    try {
      for (const walletAddress of SMART_WALLETS) {
        const recentTrades = await getRecentTrades(walletAddress);

        for (const trade of recentTrades) {
          const tradeId = `${walletAddress}-${trade.signature}`;

          if (!copiedTrades.has(tradeId) && trade.type === 'BUY') {
            console.log('\n💰 SMART MONEY BUY DETECTED:');
            console.log(`   Wallet: ${walletAddress.slice(0, 8)}...`);
            console.log(`   Token: ${trade.tokenMint}`);
            console.log(`   Amount: ${trade.solAmount} SOL`);
            console.log(`   TX: ${trade.signature}`);
            console.log(`   Time: ${new Date(trade.timestamp * 1000).toLocaleTimeString()}`);
            console.log('\n   → COPY TRADE (buying same token)');

            // TODO: Auto-execute copy buy
            // Strategy: Buy immediately with 10% of their size or fixed amount

            copiedTrades.add(tradeId);
          }
        }
      }

      await new Promise(r => setTimeout(r, 30000)); // Check every 30s (avoid rate limits)

    } catch (err) {
      console.error(`[Error] ${err.message}`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

async function getRecentTrades(walletAddress) {
  // Get recent trades via RPC signatures (simpler than Helius API)
  try {
    const pubkey = new PublicKey(walletAddress);
    const signatures = await conn.getSignaturesForAddress(pubkey, { limit: 10 });
    const data = signatures;

    const trades = [];

    for (const sigInfo of data) {
      // Fetch full transaction
      const tx = await conn.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx || !tx.meta) continue;

      // Detect buys (simplified - SOL decrease means buy)
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      const accountKeys = tx.transaction.message.accountKeys;
      
      const walletIndex = accountKeys.findIndex(k => k.pubkey.toString() === walletAddress);
      if (walletIndex === -1) continue;

      const solChange = (preBalances[walletIndex] - postBalances[walletIndex]) / 1e9;

      if (solChange > 0.01) { // Spent >0.01 SOL (buy)
        trades.push({
          signature: sigInfo.signature,
          type: 'BUY',
          tokenMint: 'Unknown', // Would need deeper parsing
          solAmount: solChange,
          timestamp: sigInfo.blockTime
        });
      }
    }

    return trades;

  } catch (err) {
    console.error(`Failed to fetch trades for ${walletAddress}: ${err.message}`);
    return [];
  }
}

monitorSmartMoney();
