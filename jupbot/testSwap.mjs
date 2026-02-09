#!/usr/bin/env node
// Quick test of Jupiter Ultra API swap

import { execSync } from 'child_process';

const WSOL = 'So11111111111111111111111111111111111111112';
const RAY = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
const AMOUNT = 50000000; // 0.05 SOL
const SLIPPAGE = 300; // 3%

console.log('🧪 Testing Jupiter Ultra API swap...');
console.log(`   From: ${AMOUNT / 1e9} SOL`);
console.log(`   To: RAY`);
console.log(`   Slippage: ${SLIPPAGE / 100}%\n`);

try {
  const result = execSync(
    'node ./sdkSwap.mjs',
    { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: '/home/j/.openclaw/workspace/jupbot',
      env: {
        ...process.env,
        SWAP_WALLET: '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json',
        INPUT_MINT: WSOL,
        OUTPUT_MINT: RAY,
        AMOUNT_LAMPORTS: String(AMOUNT),
        SLIPPAGE_BPS: String(SLIPPAGE),
        TX_VERSION: 'V0',
        FORCE_JUPITER: '1'
      }
    }
  );
  
  console.log('✅ Swap successful!');
  console.log(result);
} catch (e) {
  console.log('❌ Swap failed:');
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  process.exit(1);
}
