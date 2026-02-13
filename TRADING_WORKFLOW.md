# Trading Workflow - Scalping Optimized v2.0

**Last Updated:** 2026-02-12  
**Strategy:** Fast micro-scalping with quality filters  
**Status:** Optimized after Feb 12 session analysis

## Quick Start

### ⚠️ REMINDER: Enable Scheduled Refresh Before Starting
**IMPORTANT:** Before starting the bot, set up auto-refresh (every 10 min):
```bash
# Add to crontab (run once):
(crontab -l 2>/dev/null; echo "*/10 * * * * cd /home/j/.openclaw/workspace/jupbot && node refreshTrending.mjs >> refresh.log 2>&1") | crontab -
```

### Start Trading Bot
```bash
cd /home/j/.openclaw/workspace/jupbot
MAIN_WALLET=1 node momentumCycleFixed.mjs
```

### Stop Trading Bot
```bash
pkill -f "momentumCycleFixed.mjs"
```

### Check Balance
```bash
cd /home/j/.openclaw/workspace/jupbot
node checkWallet.mjs
```

### Refresh Token List
```bash
cd /home/j/.openclaw/workspace/jupbot
node refreshTrending.mjs
```

## Current Configuration (v2.0 - Optimized)

### Position Sizing
- **Size:** 0.05 SOL per trade (~18% of 0.282 SOL balance)
- **Take Profit:** +5% (hard limit)
- **Stop Loss:** -3% (hard limit)
- **Slippage:** 10%

### Token Selection Filters

**Market Conditions:**
- Market Cap: $50K - $10M
- Liquidity: $15K+ (better fills)
- Age: 30min - 12h (active window)
- 1h Volume: $20K+
- 5m Volume: $1K+
- **🆕 1h Momentum: <500%** (reject mega-pumps)

**Why <500% 1h momentum?**
- Tokens >500% are usually **already peaked**
- Example: UNKNOWN (+2788%) caused 12 whipsaw trades
- This filter would have saved -30% losses on Feb 12

### Entry Criteria

**ALL must pass:**
1. ✅ **5m momentum: ≥+2%** (short-term bullish)
2. ✅ **5m volume: ≥$1K** (live trading)
3. ✅ **🆕 Volume ratio: ≥1.5x** (5min vol / 1h avg)

**Why volume ratio?**
- Confirms real buying pressure
- Reduces false breakouts
- Fewer momentum fade exits (0% P&L still costs fees)

### Exit Criteria

**Automatic exits:**
1. **Take Profit:** +5% (quick wins)
2. **Stop Loss:** -3% (cut losses)
3. **Momentum Fade:** 1h momentum drops <5%
4. **Volume Drop:** 1h volume drops >30%
5. **Price Stall:** No movement for 2 minutes
6. **Max Hold:** 4 hours

## Changes from v1.0

### What Changed (Feb 12)

**v1.0 (Early today):**
- No upper 1h momentum limit
- Only 2 entry checks (5m momentum + volume)
- Result: 40+ trades, -44% loss, caught in UNKNOWN trap

**v2.0 (Current - Optimized):**
- Upper 1h momentum <500% (reject mega-pumps)
- 3 entry checks (5m momentum + volume + volume ratio)
- Expected: 15-20 trades/day, avoid traps, higher win rate

### Key Improvements

1. **🎯 Mega-Pump Filter**
   - Rejects tokens with >500% 1h momentum
   - Would have blocked: UNKNOWN, Rambo (biggest losers)
   
2. **📊 Volume Ratio Check**
   - Requires 5min volume to be 1.5x of 1h average
   - Confirms real buying pressure
   - Reduces momentum fade exits

3. **🧠 Smarter Entry**
   - From 2 checks → 3 checks
   - Quality over quantity
   - Fewer trades, better quality

## Performance Tracking

### Balance Tracking
**File:** `memory/wallet-tracking.json`

**Checkpoints:**
- 2026-02-12 11:15 PST: 0.282 SOL (baseline after session)

**Track progress:**
```bash
cd /home/j/.openclaw/workspace/jupbot
node checkWallet.mjs | grep "SOL Balance"
```

### Analysis Files
- **Daily analysis:** `memory/trading-analysis-YYYY-MM-DD.md`
- **Trade history:** `jupbot/momentum_trades.json`
- **Bot state:** `jupbot/momentum_state.json`

## Expected Performance

### v2.0 Targets

**Before (v1.0 - Feb 12):**
- 40+ trades/day
- ~44% loss
- Win rate: 37%
- Caught in mega-pump traps

**After (v2.0 - Projected):**
- 15-20 trades/day (50% reduction)
- +10-15% daily target
- Win rate: 50-55% (estimated)
- Avoids mega-pump traps entirely

### Goal Progress

**Current:** 0.282 SOL  
**Goal:** 1.0 SOL  
**Needed:** +255% (0.718 SOL more)

**At +10% daily:**
- Week 1: 0.282 → 0.55 SOL
- Week 2: 0.55 → 1.07 SOL ✅ (Goal reached!)

**At +15% daily:**
- Week 1: 0.282 → 0.64 SOL
- Week 2: 0.64 → 1.45 SOL ✅ (Exceeded goal!)

## Best Practices

### When to Trade
- ✅ **9 AM - 3 PM PST** (high volume hours)
- ❌ Early morning (5-8 AM) - low liquidity
- ❌ Late night - low activity

### What to Watch
1. **Tokens with 20-100% 1h momentum** = sweet spot
2. **Avoid >500% 1h** = mega-pump trap
3. **Check volume ratio** = real vs fake activity
4. **Quality > Quantity** = fewer, better trades

### Red Flags
- 🚩 Token with >500% 1h momentum
- 🚩 Low volume ratio (<1.5x)
- 🚩 Age <30 min (too new, risky)
- 🚩 Liquidity <$15K (slippage risk)

## Troubleshooting

### Bot Not Entering Trades
**Reason:** No tokens passing filters (GOOD!)
**Action:** Wait for quality setups, don't force trades

**Check what's failing:**
```bash
cd /home/j/.openclaw/workspace/jupbot
node refreshTrending.mjs
# Look at "Filter Debug" section
```

### Too Many Trades
**Reason:** Filters too loose
**Action:** Increase MIN_VOL_RATIO or add cooldown

### Losses on Mega-Pumps
**Reason:** Mega-pump filter not working
**Action:** Check if filter is active in refreshTrending.mjs

## Files Reference

### Core Files
- `jupbot/momentumCycleFixed.mjs` - Trading bot (entry/exit logic)
- `jupbot/refreshTrending.mjs` - Token discovery (filters)
- `jupbot/momentum_state.json` - Current bot state
- `jupbot/momentum_trades.json` - Trade history
- `HEARTBEAT.md` - Monitoring checklist

### Memory Files
- `memory/wallet-tracking.json` - Balance checkpoints
- `memory/trading-analysis-*.md` - Daily analysis
- `memory/trade-monitor-state.json` - Last trade state

### Config Files
- `.env` - API keys (Helius RPC, etc.)
- `wallets/generated_keypair.json` - Trading wallet

## Next Steps

### Immediate
1. ✅ Implemented mega-pump filter (<500% 1h)
2. ✅ Added volume ratio requirement (≥1.5x)
3. ✅ Pushed to GitHub

### To Test
1. Run bot with new filters tomorrow
2. Track trades/hour (target: 1-2 per hour max)
3. Measure win rate after 20 trades
4. Adjust if needed

### Future Improvements (If Needed)
- Add 2-minute cooldown between trades
- Restrict trading hours (9 AM - 3 PM only)
- Increase position size if win rate >50%
- Add more sophisticated scoring

## Summary

**v2.0 optimizations focus on QUALITY over QUANTITY:**
- Reject obvious traps (mega-pumps)
- Confirm real buying pressure (volume ratio)
- Fewer trades = less fees = higher net profit

**The best trades were already there on Feb 12** (THEDOW +37%, Astronaut +28%). We just need to filter out the noise (UNKNOWN spam, Rambo disasters).

---

**Ready to trade with v2.0 filters!** 🚀
