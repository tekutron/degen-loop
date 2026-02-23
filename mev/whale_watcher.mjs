// Whale Wallet Watcher - Copy profitable traders
// Monitor known winning wallets and copy their buys instantly

import { Connection, PublicKey } from '@solana/web3.js';

// Use public RPC to avoid API key issues
const RPC = 'https://api.mainnet-beta.solana.com';
const conn = new Connection(RPC, 'confirmed');

// Known profitable wallets (add more as discovered)
const WHALE_WALLETS = [
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE', // Example profitable trader
  // Add more whale addresses from Cielo/GMGN.ai/Bullx
];

const lastCheckedSignatures = new Map();

async function watchWhales() {
  console.log('[Whale Watcher] Starting...');
  console.log(`[Whale Watcher] Monitoring ${WHALE_WALLETS.length} profitable wallets\n`);

  for (const wallet of WHALE_WALLETS) {
    console.log(`   → ${wallet}`);
  }
  console.log('');

  while (true) {
    try {
      for (const walletAddress of WHALE_WALLETS) {
        const pubkey = new PublicKey(walletAddress);
        const lastSig = lastCheckedSignatures.get(walletAddress);

        const options = lastSig ? { before: lastSig, limit: 5 } : { limit: 5 };
        const signatures = await conn.getSignaturesForAddress(pubkey, options);

        if (signatures.length === 0) continue;

        for (const sig of signatures.reverse()) {
          const tx = await conn.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });

          if (!tx || !tx.meta) continue;

          // Detect token buys
          const buyInfo = detectBuy(tx, walletAddress);

          if (buyInfo) {
            console.log('\n🐋 WHALE BUY DETECTED:');
            console.log(`   Wallet: ${walletAddress.slice(0, 8)}...`);
            console.log(`   Token: ${buyInfo.tokenMint}`);
            console.log(`   Amount: ~${buyInfo.solAmount} SOL`);
            console.log(`   TX: ${sig.signature}`);
            console.log(`   Time: ${new Date().toLocaleTimeString()}`);
            console.log('\n   → COPY TRADE SIGNAL');

            // TODO: Auto-execute copy buy
            // Strategy: Buy same token with 0.01 SOL
          }

          lastCheckedSignatures.set(walletAddress, sig.signature);
        }
      }

      await new Promise(r => setTimeout(r, 30000)); // Check every 30s (avoid rate limits)

    } catch (err) {
      console.error(`[Error] ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

function detectBuy(tx, walletAddress) {
  try {
    const instructions = tx.transaction.message.instructions;
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;

    // Find SOL decrease (indicating buy)
    const accountKeys = tx.transaction.message.accountKeys;
    const walletIndex = accountKeys.findIndex(k => k.pubkey.toString() === walletAddress);

    if (walletIndex === -1) return null;

    const solChange = (preBalances[walletIndex] - postBalances[walletIndex]) / 1e9;

    if (solChange > 0.01) { // Spent >0.01 SOL (likely a buy)
      // Try to extract token mint from transaction
      let tokenMint = 'Unknown';

      for (const ix of instructions) {
        if (ix.parsed?.info?.mint) {
          tokenMint = ix.parsed.info.mint;
          break;
        }
      }

      // Also check token balances changes
      if (tx.meta.postTokenBalances && tx.meta.postTokenBalances.length > 0) {
        for (const balance of tx.meta.postTokenBalances) {
          if (balance.owner === walletAddress) {
            tokenMint = balance.mint;
            break;
          }
        }
      }

      return {
        tokenMint,
        solAmount: solChange.toFixed(4)
      };
    }

    return null;
  } catch {
    return null;
  }
}

watchWhales();
