const axios = require('axios');
(async()=>{
  const inputMint = process.env.INPUT_MINT || 'So11111111111111111111111111111111111111112';
  const outputMint = process.env.OUTPUT_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const amount = process.env.AMOUNT_LAMPORTS || '5000000';
  const slippageBps = process.env.SLIPPAGE_BPS || '50';
  const txVersion = process.env.TX_VERSION || 'V0';
  const url = 'https://transaction-v1.raydium.io/compute/swap-base-in';
  const { data } = await axios.get(url, { params: { inputMint, outputMint, amount, slippageBps, txVersion } });
  console.log('compute keys:', Object.keys(data||{}));
  console.log(JSON.stringify(data, null, 2));
})();