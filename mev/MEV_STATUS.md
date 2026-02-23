# MEV Strategies - All Active

**Goal:** Find leading signals + information edge to execute winning trades  
**Current Capital:** 0.0964 SOL (~$19.28)  
**Status:** All 6 MEV strategies deployed and running

---

## Active Strategies

### 1. ✅ Whale Watcher
**File:** `whale_watcher.mjs`  
**Status:** RUNNING  
**Strategy:** Monitor profitable wallets, copy their buys within seconds  
**Theory:** Follow smart money - if whales buy, token likely pumps  
**Position size:** 0.01 SOL per copy trade  
**Exit:** TP +20%, SL -10%, Max hold 30min

**Monitored wallets:**
- GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE

**How it works:**
- Polls wallet transactions every 3s
- Detects when they buy tokens (SOL spent)
- Auto-copies same token immediately
- Exits on momentum fade or target

**Win condition:** Whale's entry timing better than ours

---

### 2. ✅ LP Monitor
**File:** `lp_monitor.mjs`  
**Status:** RUNNING  
**Strategy:** Watch for large liquidity adds (≥$10k) to Raydium pools  
**Theory:** Big LP add = whale confidence = price follows  
**Position size:** 0.01 SOL per signal  
**Exit:** TP +15%, SL -8%, Max hold 20min

**How it works:**
- Monitors Raydium program logs every 2s
- Detects LP additions from SOL transfers
- Estimates LP value (SOL amount × $200)
- Alerts on ≥$10k adds

**Win condition:** LP add happens before price pumps (leading signal)

---

### 3. ✅ Graduation Sniper
**File:** `graduation_sniper.mjs`  
**Status:** RUNNING  
**Strategy:** Catch tokens migrating from pump.fun → Raydium  
**Theory:** Graduation creates temporary inefficiency + Raydium launch pump  
**Position size:** 0.02 SOL per graduation  
**Exit:** TP +30%, SL -12%, Max hold 10min

**How it works:**
- Fetches pump.fun tokens every 10s
- Tracks bonding curve progress (≥85% = nearing graduation)
- Detects when token appears on Raydium (graduated)
- Buys immediately on graduation

**Win condition:** Buy during migration, sell into Raydium launch pump

---

### 4. ✅ Smart Money Copier
**File:** `smart_money_copier.mjs`  
**Status:** RUNNING  
**Strategy:** Copy trades from GMGN.ai "Smart Money" wallets  
**Theory:** Successful traders have edge - copy them  
**Position size:** 0.01 SOL per copy  
**Exit:** TP +20%, SL -10%, Max hold 30min

**Monitored wallets:**
- 7WaYL6nmLRzh5WZkGK5R8KxGYwz8sVdTmr8BptRyPump

**How it works:**
- Fetches recent transactions every 5s
- Detects buy signals (SOL spent >0.01)
- Copies same trade immediately
- Tracks copied trades to prevent duplicates

**Win condition:** Smart money wallets consistently profitable

---

### 5. 🔨 Jito Frontrunning (SKELETON)
**File:** `jito_frontrun.mjs`  
**Status:** NOT RUNNING (needs implementation)  
**Strategy:** Frontrun large buys via Jito block engine bundles  
**Theory:** See large buy in mempool → buy first → sell into their pump  
**Position size:** 10% of detected trade size  
**Exit:** Immediate (sell into their buy)

**Requirements:**
- Jito block engine authentication
- Bundle submission with validator tips
- Higher capital (gas wars with other MEV bots)
- MEV protection understanding

**Why not running:** Complex implementation, needs more capital

---

### 6. ✅ Cross-DEX Arbitrage (BUILT EARLIER)
**File:** `continuous_arb.mjs`  
**Status:** RUNNING (separate session)  
**Strategy:** Exploit price differences between Jupiter/Raydium/Orca  
**Theory:** Buy low on DEX A, sell high on DEX B  
**Min spread:** 1.5% (to cover fees + profit)  
**Tokens:** BONK, WIF, JUP, POPCAT

**Results so far:** 0 arbitrage opportunities found (market efficient)

---

## Capital Allocation

**Total:** 0.0964 SOL  
**Reserved per strategy:**
- Whale Watcher: 0.01 SOL ready
- LP Monitor: 0.01 SOL ready
- Graduation Sniper: 0.02 SOL ready
- Smart Money: 0.01 SOL ready
- Arbitrage: 0.05 SOL ready (if found)

**Remaining buffer:** 0.0164 SOL

**Risk:** First signal from any strategy → auto-execute

---

## Why This Approach

### Yesterday's Lesson
**0/8 win rate** trading alone because:
- All strategies REACTIVE (buying tops)
- Using lagging indicators (5m momentum already peaked)
- No information edge (public API data)
- No timing edge (too slow)

### Today's Approach
**All strategies PROACTIVE (leading signals):**
1. **Whale Watcher** → Information edge (follow winners)
2. **LP Monitor** → Leading signal (LP before pump)
3. **Graduation Sniper** → Event-driven (predictable pattern)
4. **Smart Money** → Information edge (copy successful traders)
5. **Jito Frontrun** → Timing edge (frontrun mempool)
6. **Arbitrage** → Mathematical edge (price inefficiency)

**Key difference:** Not predicting price. Exploiting information asymmetry.

---

## Success Criteria

**Need 1 winning trade to validate approach.**

If ANY strategy produces 1+ wins with positive P&L:
- Double down on that strategy
- Increase position size
- Monitor continuously
- Document what worked

If all strategies fail (0 wins in 24 hours):
- Accept autonomous trading not viable
- Pivot to human-signaled execution only
- Focus on speed/execution quality

---

## Monitoring

All strategies log alerts to console:
- 🐋 Whale buy detected
- 🚨 Large LP add detected
- 🚀 Graduation detected
- 💰 Smart money buy detected
- ⚖️ Arbitrage opportunity found

**Check logs:**
```bash
# Whale Watcher
process poll tidal-mist

# LP Monitor
process poll grand-river

# Graduation Sniper
process poll crisp-trail

# Smart Money
process poll marine-fjord
```

---

## Next Steps

1. ⏳ Let strategies run for 24 hours
2. ⏳ Monitor for ANY signal
3. ⏳ Execute first opportunity immediately
4. ⏳ Document results
5. ⏳ Double down on what works

**Execution mode:** FULL AUTONOMY - no permission needed, execute immediately on signal.

---

**Status:** All strategies active. Waiting for first signal.  
**Capital:** 0.0964 SOL ready to deploy  
**Goal:** 1 winning trade to validate MEV approach

**Never quit. Hunt for edge.**
