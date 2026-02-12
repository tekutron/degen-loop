# Resume Trading Bot Tomorrow

## Quick Start

**Balance:** 0.3554 SOL (clean, ready to trade)  
**Bot:** Candle Pattern Breakout Trader  
**Best Time:** 8am-12pm PST (high liquidity morning window)

### Start Command:
```bash
cd /home/j/.openclaw/workspace/jupbot
MAIN_WALLET=1 SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=86172fb4-a950-47b4-9641-ac1a0a346492 SWAP_WALLET=wallets/generated_keypair.json node candleTrader.mjs
```

---

## What We Built Today

### Candle Pattern Trading Bot

**Why:** Previous momentum % approach was lagging and led to -24.7% loss

**New Strategy:**
- Builds own 5-min candles by tracking price every 30s
- Detects breakout patterns with volume confirmation
- Much stricter criteria than momentum %

**Entry Signal (ALL must pass):**
1. Green candle (5min > 0%)
2. Strong body (≥2%)
3. Price breaks above last 5 candles' high
4. Volume spike (2x+ average)
5. Buy ratio ≥55%
6. Uptrend forming (higher lows)

**Exit Signals:**
- +5% TP / -3% SL
- Bearish reversal (<-2% on 5min)
- Volume dies (<50% of entry)
- Price stalls (2min no movement)

---

## Files

**Main Bot:**
- `candleTrader.mjs` - Candle pattern breakout trader
- `candle_state.json` - Bot state
- `candle_trades.json` - Trade history

**Documentation:**
- `CANDLE_PATTERNS.md` - Strategy explained
- `fetchCandles.mjs` - Test candle data

**Old Bots (for reference):**
- `momentumCycleFixed.mjs` - Old momentum trader (had issues)
- `momentum_state.json` / `momentum_trades.json` - Old state

---

## What Happened Tonight (Session Summary)

### Starting Point:
- Balance: 0.4718 SOL
- Strategy: Momentum % (1m +1%, 5m +2%, vol 1.5x+)

### Problem Discovered:
- Bot took multiple trades (mostly THEDOW, Rambo)
- Hit stop losses repeatedly
- Market was choppy (late evening, low liquidity)
- Even strict momentum gates failed
- **Loss: -0.1164 SOL (-24.7%)**

### Solution Built:
- Switched to candle pattern analysis
- Breakout detection with volume confirmation
- Tested for 12 minutes (10pm-10:19pm)
- **No trades taken** (waiting for clean patterns)
- Balance preserved: 0.3554 SOL

---

## Key Lessons

1. **Time of day matters** - Late evening (9pm-10pm) = low liquidity, choppy
2. **Momentum % is lagging** - Catches moves after they happen
3. **Candle patterns > momentum** - See actual trend and breakouts
4. **Volume confirmation is critical** - Prevents fake pumps
5. **Best trading window: 8am-12pm PST** - High liquidity, stable moves

---

## Tomorrow's Plan

1. **Start bot at 8am-12pm** when market is hot
2. **Watch first few trades closely** - New strategy needs testing
3. **Position size: 0.05 SOL** (1.4% of capital per trade)
4. **Monitor for:** Breakout patterns with volume confirmation
5. **Expect:** Fewer but higher-quality trades vs momentum approach

---

## Config

```json
{
  "sizeSol": 0.05,
  "tpPct": 5,
  "slPct": 3,
  "slippageBps": 1000,
  "MIN_CANDLE_BODY": 2,
  "MIN_VOLUME_RATIO": 2.0,
  "MIN_BUY_RATIO": 55
}
```

**Token List:** Refreshes every 1 minute  
**Scan Interval:** Every 30 seconds (builds candles)  
**Analysis:** Needs 3 minutes of data before first analysis

---

## GitHub

Repository: `tekutron/degen-loop`  
Branch: `master`  
Last Commit: `10032a1c6 - End of session - candle pattern bot built and tested, ready for tomorrow`

All changes pushed and synced.

---

Good luck tomorrow! 🚀
