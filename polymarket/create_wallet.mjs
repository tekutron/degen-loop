// Create Polygon wallet for Polymarket trading

import { Wallet } from 'ethers';
import fs from 'fs';

console.log('🔐 Creating Polygon wallet...\n');

// Generate new random wallet
const wallet = Wallet.createRandom();

console.log('✅ Wallet created!\n');
console.log('📍 Public Address (for funding):');
console.log(`   ${wallet.address}\n`);
console.log('🔑 Private Key (KEEP SECRET):');
console.log(`   ${wallet.privateKey}\n`);

// Save to secure file
const walletData = {
  address: wallet.address,
  privateKey: wallet.privateKey,
  mnemonic: wallet.mnemonic.phrase,
  created: new Date().toISOString(),
  network: 'Polygon',
  purpose: 'Polymarket trading'
};

fs.writeFileSync(
  '/home/j/.openclaw/workspace/wallets/polymarket_wallet.json',
  JSON.stringify(walletData, null, 2),
  { mode: 0o600 } // Read/write for owner only
);

console.log('💾 Wallet saved to: /home/j/.openclaw/workspace/wallets/polymarket_wallet.json');
console.log('   (File permissions: owner read/write only)\n');

console.log('🌐 Network: Polygon (MATIC)');
console.log('💰 Required: USDC on Polygon for trading\n');

console.log('📋 FUNDING INSTRUCTIONS:');
console.log('1. Send USDC to the address above');
console.log('2. Must be on Polygon network (NOT Ethereum mainnet)');
console.log('3. Recommended starting amount: $100-500 USDC');
console.log('4. Bridge USDC: https://wallet.polygon.technology/polygon/bridge');
console.log('   OR buy directly on Polygon via exchanges\n');

console.log('⚠️  SECURITY:');
console.log('- Never share your private key');
console.log('- Backup your mnemonic phrase offline');
console.log('- This wallet is saved locally with restricted permissions\n');
