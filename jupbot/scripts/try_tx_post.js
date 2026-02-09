const axios = require('axios');
(async()=>{
  const inputMint="So11111111111111111111111111111111111111112";
  const outputMint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const amount="5000000";
  const slippageBps="50";
  const txVersion="V0";
  const owner=process.env.OWNER||"8T4jWyFfxjN1YjkesR2JVK955Za38p6S6i4MqKR6LXGA";
  const comp=(await axios.get("https://transaction-v1.raydium.io/compute/swap-base-in",{params:{inputMint,outputMint,amount,slippageBps,txVersion}})).data;
  const fee=(await axios.get("https://api-v3.raydium.io/main/auto-fee")).data;
  const micro=Math.min(Math.ceil((fee?.default?.vh??fee?.vh??5000)),25000);
  const bodies=[
    { computeUnitPriceMicroLamports: micro, swapResponse: comp.data, txVersion, wallet: owner, wrapSol:true },
    { computeUnitPriceMicroLamports: String(micro), swapResponse: comp.data, txVersion, wallet: owner, wrapSol:true },
    { computeUnitPriceMicroLamports: String(micro), dynamicComputeUnitLimit: true, swapResponse: comp.data, txVersion, wallet: owner, wrapSol:true },
    { computeUnitPriceMicroLamports: micro, dynamicComputeUnitLimit: true, swapResponse: comp.data, txVersion, wallet: owner, wrapSol:true }
  ];
  for (const body of bodies){
    try{
      const resp=await axios.post('https://transaction-v1.raydium.io/transaction/swap-base-in', body);
      console.log('OK body variant', JSON.stringify(body));
      console.log('resp keys', Object.keys(resp.data||{}));
      console.log(JSON.stringify(resp.data,null,2));
      break;
    }catch(e){
      const d=e.response?.data; console.log('ERR body', JSON.stringify(body)); console.log(d||e.message);
    }
  }
})();