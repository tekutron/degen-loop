// LP Monitoring - Detect large liquidity adds to Raydium pools
// Theory: Big LP add = whale confidence = price follows

import { Connection, PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';

// Use public RPC instead of Helius (API key might be rate limited)
const RPC = 'https://api.mainnet-beta.solana.com';
const conn = new Connection(RPC, 'confirmed');

const RAYDIUM_PROGRAM = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const MIN_LP_ADD_USD = 10000; // Only care about $10k+ LP adds

// Monitor Raydium program logs for LP add events
async function monitorLPAdds() {
  console.log('[LP Monitor] Starting...');
  console.log(`[LP Monitor] Watching for LP adds ≥$${MIN_LP_ADD_USD.toLocaleString()}\n`);

  let lastSignature = null;

  while (true) {
    try {
      const options = lastSignature ? { before: lastSignature, limit: 10 } : { limit: 10 };
      const signatures = await conn.getSignaturesForAddress(RAYDIUM_PROGRAM, options);

      if (signatures.length === 0) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      for (const sig of signatures.reverse()) {
        const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        
        if (!tx || !tx.meta) continue;

        // Look for LP add patterns
        const isLPAdd = tx.transaction.message.instructions.some(ix => {
          const programId = ix.programId?.toString();
          return programId === RAYDIUM_PROGRAM.toString();
        });

        if (isLPAdd) {
          const lpAmount = await estimateLPValue(tx);
          
          if (lpAmount >= MIN_LP_ADD_USD) {
            const tokenMint = extractTokenMint(tx);
            
            console.log('\n🚨 LARGE LP ADD DETECTED:');
            console.log(`   Token: ${tokenMint}`);
            console.log(`   LP Added: ~$${lpAmount.toLocaleString()}`);
            console.log(`   TX: ${sig.signature}`);
            console.log(`   Time: ${new Date().toLocaleTimeString()}`);
            console.log('\n   → Potential buy signal (whale confidence)');
            
            // TODO: Auto-execute buy here
            // For now, just alert
          }
        }

        lastSignature = sig.signature;
      }

      await new Promise(r => setTimeout(r, 30000)); // Poll every 30s (avoid rate limits)

    } catch (err) {
      console.error(`[Error] ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

function extractTokenMint(tx) {
  // Extract token mint from transaction
  try {
    const instructions = tx.transaction.message.instructions;
    for (const ix of instructions) {
      if (ix.parsed?.info?.mint) {
        return ix.parsed.info.mint;
      }
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function estimateLPValue(tx) {
  // Estimate LP value from SOL transfers in transaction
  try {
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    
    let maxSOLChange = 0;
    for (let i = 0; i < preBalances.length; i++) {
      const change = Math.abs(postBalances[i] - preBalances[i]) / 1e9;
      if (change > maxSOLChange) maxSOLChange = change;
    }
    
    // Rough estimate: LP add usually includes SOL
    // Assume SOL = $200 for quick calc
    return maxSOLChange * 200;
  } catch {
    return 0;
  }
}

monitorLPAdds();
