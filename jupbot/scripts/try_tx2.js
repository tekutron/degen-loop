const axios = require('axios');
(async()=>{
  const inputMint='So11111111111111111111111111111111111111112';
  const outputMint='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const amount='5000000';
  const slippageBps='50';
  const txVersion='V0';
  const owner=process.env.OWNER||'8T4jWyFfxjN1YjkesR2JVK955Za38p6S6i4MqKR6LXGA';
  const comp=(await axios.get('https://transaction-v1.raydium.io/compute/swap-base-in',{params:{inputMint,outputMint,amount,slippageBps,txVersion}})).data;
  const body={computeUnitPriceMicroLamports:10000,computeUnitLimit:600000,swapResponse:comp.data,txVersion,wallet:owner,wrapSol:true};
  try{const resp=await axios.post('https://transaction-v1.raydium.io/transaction/swap-base-in',body);console.log('OK', resp.data);}catch(e){console.log('ERR', e.response?.data||e.message)}
})();