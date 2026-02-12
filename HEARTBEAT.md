# HEARTBEAT.md

## Trading Workflow (Momentum Cycling - Riskier Tier - Updated 2026-02-11 15:20)
**Strategy:** Early snipes on fresh launches, ride momentum UP, exit when it fades

**Configuration:**
- Position size: **0.05 SOL** (~10-12% capital)
- Take Profit: **+5%** (hard limit)
- Stop Loss: **-3%** (hard limit)
- Slippage: **10%** (volatile tokens)
- Price polling: **3 seconds** (fast reaction ⚡)
- List refresh: **5 minutes** (catch new momentum)
- ONE coin at a time (focused capital)

**Entry Criteria (RISKIER - Early Snipes - Real-Time Focus):**
- Market Cap: $50K - $10M (allows smaller caps)
- Liquidity: $8.5K+ (matches DexScreener "Riskier")
- Age: 20min - 2 years (catch early launches)
- 1h Volume: $10K+ (immediate activity)
- 5min Volume: $1K+ (catching momentum early)
- **1m momentum: ≥+1%** (pumping RIGHT NOW - prevents buying tops)
- **5m momentum: ≥+2%** (positive short-term)
- **Volume ratio: ≥1.5x** (5min vs 1h avg - buying pressure)
- **Buy ratio: ≥55%** (healthy demand)
- NO stablecoins (direct SOL only)
- **NO 1h momentum filter** (removed lagging indicator)
- **Picks token with highest 1m+5m score** when criteria met

**Exit Criteria (Momentum-Based):**
1. **Take Profit:** +5% (hard limit, take wins)
2. **Stop Loss:** -3% (hard limit, cut losses)
3. **Momentum Fade:** Exit if 1h momentum drops below 5%
4. **Volume Drop:** Exit if 1h volume drops >30% from entry
5. **Price Stall:** Exit if no movement for 2 minutes
6. **Max Hold:** 4 hours (don't baghold)

**Risk Level:** 🔴 HIGH - Early launches, smaller caps, higher volatility

# Auto-Trading Bot - ACTIVE 2026-02-11 21:15 (NO 1H FILTER)
## Automated Entry + Trade Execution (STRICT CRITERIA)
1. Read trending_tokens_feb9.json (refreshes every 5min)
2. Analyze each token's chart with real-time 1m momentum tracking
3. **ONLY enter when ALL criteria pass** (removed 1h lagging indicator):
   - **1min: ≥+1%** (pumping RIGHT NOW - prevents buying tops)
   - **5min: ≥+2%** (positive short-term momentum)
   - **Volume: ≥1.5x** (5min vol vs 1h avg - buying pressure)
   - **Buy ratio: ≥55%** (healthy demand)
   - **NO 1h filter** - focuses on real-time momentum only
4. Bot auto-buys when token passes ALL gates
5. Exits on: TP (+5%), SL (-3%), momentum fade (<5% 1h), volume drop (>30%), stall (2min)
6. After exit, resumes scanning for next qualified token
7. **Strategy:** Catch tokens pumping NOW on short timeframes

# Trading Bot Monitor - DISABLED 2026-02-09
# ## Trading Bot Monitor (every check)
# 1. Read `/home/j/.openclaw/workspace/jupbot/cycle_state.json`
# 2. Read `/home/j/.openclaw/workspace/jupbot/cycle_trades.json`
# 3. Check if monitored trade (from `memory/trade-notify-state.json`) has closed
# 4. If trade closed (SOLD stage or exitReason set), alert user with:
#    - Token symbol
#    - Exit reason (TP or SL)
#    - Entry/exit prices
#    - P&L percentage
#    - Next token being traded
# 5. Update lastCheck timestamp in `memory/trade-notify-state.json`

# Moltbook checks disabled 2026-02-08
# ## Moltbook (every 4+ hours)
# If 4+ hours since lastMoltbookCheck:
# 1. Fetch https://www.moltbook.com/heartbeat.md and follow it
# 2. Check personalized feed (limit 10) for new items; suggest 2 good posts to engage
# 3. If there are new replies/mentions, summarize and draft 1-2 responses
# 4. Update lastMoltbookCheck timestamp in memory/heartbeat-state.json
