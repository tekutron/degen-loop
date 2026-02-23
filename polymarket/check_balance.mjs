// Check Polymarket wallet balance (Polygon network)

import { ethers } from 'ethers';
import fs from 'fs';

const POLYGON_RPC = 'https://polygon-rpc.com';
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // USDC on Polygon

console.log('💰 Checking Polymarket wallet balance...\n');

// Load wallet
const walletData = JSON.parse(
  fs.readFileSync('/home/j/.openclaw/workspace/wallets/polymarket_wallet.json', 'utf8')
);

const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
const wallet = new ethers.Wallet(walletData.privateKey, provider);

console.log(`📍 Address: ${wallet.address}\n`);

try {
  // Check MATIC balance (for gas)
  const maticBalance = await provider.getBalance(wallet.address);
  const maticFormatted = ethers.formatEther(maticBalance);
  
  // Check USDC balance
  const usdcContract = new ethers.Contract(
    USDC_ADDRESS,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  const usdcBalance = await usdcContract.balanceOf(wallet.address);
  const usdcFormatted = ethers.formatUnits(usdcBalance, 6); // USDC has 6 decimals
  
  console.log('💵 BALANCES:');
  console.log(`   MATIC: ${maticFormatted} ($${(parseFloat(maticFormatted) * 0.5).toFixed(2)} @ $0.50)`);
  console.log(`   USDC:  ${usdcFormatted} (trading capital)\n`);
  
  if (parseFloat(usdcFormatted) === 0) {
    console.log('⚠️  Wallet unfunded - SIMULATION MODE ONLY');
    console.log('   Send USDC to fund for real trading\n');
  } else {
    console.log(`✅ Funded with $${usdcFormatted} USDC`);
    console.log('   Ready for real trading (currently in simulation mode)\n');
  }
  
  if (parseFloat(maticFormatted) < 0.01) {
    console.log('⚠️  Low MATIC balance');
    console.log('   Need ~$1-2 of MATIC for gas fees\n');
  }
  
} catch (err) {
  console.error('❌ Error checking balance:', err.message);
}
