const axios = require('axios');
(async()=>{
  const inputMint = process.env.INPUT_MINT || 'So11111111111111111111111111111111111111112';
  const outputMint = process.env.OUTPUT_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const amount = process.env.AMOUNT_LAMPORTS || '5000000';
  const slippageBps = process.env.SLIPPAGE_BPS || '50';
  const txVersion = process.env.TX_VERSION || 'V0';
  const owner = process.env.OWNER || '8T4jWyFfxjN1YjkesR2JVK955Za38p6S6i4MqKR6LXGA';
  const { data: comp } = await axios.get('https://transaction-v1.raydium.io/compute/swap-base-in', { params: { inputMint, outputMint, amount, slippageBps, txVersion } });
  const { data } = await axios.get('https://api-v3.raydium.io/main/auto-fee');
  const micro = Math.min(Math.ceil((data?.default?.vh ?? data?.vh ?? 5000)), 25000);
  const body = {
    computeUnitPriceMicroLamports: micro,
    swapResponse: comp.data,
    txVersion,
    wallet: owner,
    wrapSol: inputMint === 'So11111111111111111111111111111111111111112'
  };
  const resp = await axios.post('https://transaction-v1.raydium.io/transaction/swap-base-in', body);
  console.log('status', resp.status);
  console.log('keys', typeof resp.data, Array.isArray(resp.data), Object.keys(resp.data || {}));
  console.log(JSON.stringify(resp.data, null, 2));
})();