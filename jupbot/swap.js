const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const { executeSwap } = require('./raydiumSwap');

(async () => {
  // Config via env
  const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const WALLET = process.env.SWAP_WALLET || path.join(__dirname, 'wallets', 'test_swap_keypair.json');
  const TX_VERSION = process.env.TX_VERSION || 'V0'; // 'V0' | 'LEGACY'
  const SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS || 50); // default 0.5%
  const PRIORITY_TIER = process.env.PRIORITY_TIER || 'vh'; // 'vh' | 'h' | 'm'
  const SIDE = process.env.SIDE || 'in'; // 'in' | 'out'

  // Safety: require explicit confirmation to use a funded/main wallet
  if (process.env.MAIN_WALLET !== '1') {
    throw new Error('MAIN_WALLET not confirmed. Set MAIN_WALLET=1 to proceed with a funded wallet.');
  }

  const secret = JSON.parse(fs.readFileSync(WALLET, 'utf8'));
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));

  const inputMint = process.env.INPUT_MINT || 'So11111111111111111111111111111111111111112'; // SOL
  const outputMint = process.env.OUTPUT_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
  const amount = Number(process.env.AMOUNT_LAMPORTS || Math.floor(0.005 * 1_000_000_000)); // lamports

  // Basic retries: re-quote and degrade fee tier on congestion
  const tiers = [PRIORITY_TIER, 'h', 'm'].filter((v, i, a) => v && a.indexOf(v) === i);
  let lastErr;
  for (const tier of tiers) {
    try {
      const sigs = await executeSwap({
        rpcUrl: RPC,
        ownerKeypair: kp,
        side: SIDE,
        inputMint,
        outputMint,
        amount,
        slippageBps: SLIPPAGE_BPS,
        txVersion: TX_VERSION,
        wrapSol: inputMint === 'So11111111111111111111111111111111111111112',
        unwrapSol: false,
        priorityTier: tier,
      });
      console.log('TX IDs:', sigs);
      return;
    } catch (e) {
      lastErr = e;
      const msg = (e && e.message) || String(e);
      console.warn(`Swap attempt with tier=${tier} failed:`, msg);
      continue;
    }
  }
  throw lastErr || new Error('Swap failed after retries');
})();
