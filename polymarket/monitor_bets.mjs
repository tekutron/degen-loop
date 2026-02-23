// Monitor simulation state and alert on new bets

import fs from 'fs';

let lastState = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));
let lastBetCount = lastState.totalBets;

console.log('👀 Monitoring for new bets...\n');
console.log(`Current: ${lastState.wins}W - ${lastState.losses}L | Balance: $${lastState.currentCapital.toFixed(2)}\n`);

async function monitor() {
  while (true) {
    try {
      const state = JSON.parse(fs.readFileSync('/home/j/.openclaw/workspace/polymarket/simulation_state.json'));
      
      // Check for new bets
      if (state.totalBets > lastBetCount) {
        console.log('\n🔔 NEW BET DETECTED!\n');
        
        // Find the new bet
        const newBets = state.activeBets.slice(lastBetCount);
        
        for (const bet of newBets) {
          console.log('═'.repeat(70));
          console.log('💰 BET PLACED\n');
          console.log(`📊 MARKET: ${bet.marketQuestion}`);
          console.log(`   Crypto: ${bet.crypto}`);
          console.log(`   Ends: ${new Date(bet.endTime).toLocaleTimeString()}`);
          console.log('');
          console.log(`🎯 PREDICTION: ${bet.prediction}`);
          console.log(`   Confidence: ${bet.confidence}%`);
          console.log(`   Edge: ${bet.edge > 0 ? '+' : ''}${bet.edge.toFixed(1)}%`);
          console.log(`   Starting Price: $${bet.startPrice.toLocaleString()}`);
          console.log('');
          console.log(`💵 BET SIZE: $${bet.betSize}`);
          console.log(`   Potential Payout: $${(bet.betSize * 2).toFixed(2)}`);
          console.log('');
          console.log(`📈 WHY THIS BET:`);
          
          // Explain the prediction logic
          if (bet.confidence >= 75) {
            console.log(`   ✓ HIGH CONFIDENCE (${bet.confidence}%) - Strong momentum signal`);
          } else {
            console.log(`   ✓ Good confidence (${bet.confidence}%) - Moderate momentum`);
          }
          
          if (Math.abs(bet.edge) >= 10) {
            console.log(`   ✓ STRONG EDGE (${bet.edge.toFixed(1)}%) - Market mispricing detected`);
          } else {
            console.log(`   ✓ Decent edge (${bet.edge.toFixed(1)}%) - Favorable odds`);
          }
          
          if (bet.prediction === 'UP') {
            console.log(`   ✓ Bullish momentum - Price trending upward`);
          } else {
            console.log(`   ✓ Bearish momentum - Price trending downward`);
          }
          
          console.log('');
          console.log(`💰 UPDATED BANKROLL: $${state.currentCapital.toFixed(2)}`);
          console.log('═'.repeat(70) + '\n');
        }
        
        lastBetCount = state.totalBets;
      }
      
      // Check for resolved bets
      if (state.completedBets.length > lastState.completedBets.length) {
        const newCompleted = state.completedBets.slice(lastState.completedBets.length);
        
        for (const bet of newCompleted) {
          console.log('\n📊 BET RESOLVED!\n');
          console.log('═'.repeat(70));
          console.log(`📊 ${bet.marketQuestion}`);
          console.log(`   Crypto: ${bet.crypto}`);
          console.log('');
          console.log(`   Start Price: $${bet.startPrice.toLocaleString()}`);
          console.log(`   End Price: $${bet.endPrice.toLocaleString()}`);
          console.log(`   Change: ${bet.endPrice > bet.startPrice ? '+' : ''}${((bet.endPrice - bet.startPrice) / bet.startPrice * 100).toFixed(2)}%`);
          console.log('');
          console.log(`   Predicted: ${bet.prediction}`);
          console.log(`   Actual: ${bet.actualOutcome}`);
          console.log('');
          
          if (bet.status === 'WON') {
            console.log(`   ✅ WIN! +$${bet.pnl}`);
          } else {
            console.log(`   ❌ LOSS -$${Math.abs(bet.pnl)}`);
          }
          
          console.log('');
          console.log(`💰 NEW BALANCE: $${state.currentCapital.toFixed(2)}`);
          console.log(`📈 RECORD: ${state.wins}W - ${state.losses}L`);
          
          if (state.wins + state.losses > 0) {
            const winRate = (state.wins / (state.wins + state.losses) * 100).toFixed(1);
            console.log(`   Win Rate: ${winRate}%`);
          }
          
          console.log('═'.repeat(70) + '\n');
        }
      }
      
      lastState = state;
      
    } catch (err) {
      // Ignore file read errors
    }
    
    await new Promise(r => setTimeout(r, 2000)); // Check every 2s
  }
}

monitor();
