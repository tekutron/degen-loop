// liquidateAll.mjs
// Sells 100% of ALL SPL tokens in the bot wallet back to wSOL
// This includes any mistakenly acquired stablecoins (USDC, USDT, etc.)
// Live on-chain query - sells every token with balance > 0

import fs from 'node:fs';
import path from 'node:path';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const WSOL = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

function nowIso() { return new Date().toISOString(); }

async function execNode(file, env) {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    const p = spawn('node', [file], { cwd: HERE, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => {
      if (code === 0) return resolve({ out, err });
      reject(new Error(`Command failed (${code}): node ${file}\nSTDOUT:\n${out}\nSTDERR:\n${err}`));
    });
  });
}

function extractSig(stdout) {
  const m = stdout.match(/\b[1-9A-HJ-NP-Za-km-z]{80,120}\b/);
  return m ? m[0] : '';
}

async function main() {
  if (process.env.MAIN_WALLET !== '1') throw new Error('Refusing to run: set MAIN_WALLET=1');
  const rpcUrl = process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const walletPath = process.env.SWAP_WALLET || path.join(HERE, 'wallets', 'generated_keypair.json');
  const slippageBps = Number(process.env.SLIPPAGE_BPS || '150');

  // Load wallet keypair
  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('💰 Liquidating 100% of all SPL tokens → wSOL');
  
  // Get all token accounts with balance > 0
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    keypair.publicKey,
    { programId: TOKEN_PROGRAM_ID },
    'confirmed'
  );

  const sells = [];
  let skipped = 0;

  for (const { account } of tokenAccounts.value) {
    const parsed = account.data.parsed;
    const info = parsed?.info;
    if (!info) continue;

    const mint = info.mint;
    const amountRaw = info.tokenAmount.amount;
    const balance = BigInt(amountRaw);

    // Skip if zero balance
    if (balance === 0n) {
      skipped++;
      continue;
    }

    // Skip wSOL (we're selling TO wSOL, not selling wSOL itself)
    if (mint === WSOL) {
      console.log(`⏭️  Skipping wSOL (target token)`);
      skipped++;
      continue;
    }

    console.log(`📤 Selling 100% of ${mint}: ${amountRaw} raw`);

    const env = {
      SOLANA_RPC: rpcUrl,
      SWAP_WALLET: walletPath,
      INPUT_MINT: mint,
      OUTPUT_MINT: WSOL,
      AMOUNT_LAMPORTS: String(amountRaw),
      SLIPPAGE_BPS: String(slippageBps),
      TX_VERSION: 'V0',
      MAIN_WALLET: '1',
    };

    try {
      const out = await execNode('./sdkSwap.mjs', env);
      const sig = extractSig(out.out);
      sells.push({ mint, amountRaw, sig, success: true });
      console.log(`✓ Sold ${mint}: ${sig}`);
    } catch (e) {
      sells.push({ mint, amountRaw, error: e.message, success: false });
      console.error(`✗ Failed to sell ${mint}:`, e.message);
    }
  }

  if (sells.length === 0) {
    console.log('\n✅ No tokens to liquidate (wallet only contains wSOL)');
    console.log(`   Skipped ${skipped} empty/wSOL accounts`);
  } else {
    console.log(`\n✅ Liquidation complete: ${sells.length} tokens sold, ${skipped} skipped`);
    const successful = sells.filter(s => s.success).length;
    const failed = sells.length - successful;
    if (failed > 0) {
      console.log(`   ⚠️  ${failed} sell(s) failed - check errors above`);
    }
  }

  console.log(JSON.stringify({ ok: true, liquidated: sells.length, skipped, sells }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
