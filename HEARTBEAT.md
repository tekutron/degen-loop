# HEARTBEAT.md

## Trading Workflow (Scalping Optimized - Updated 2026-02-12 10:33)
**Strategy:** Micro-scalp active tokens with tight TP/SL, focus on liquidity + volume

**Configuration:**
- Position size: **0.05 SOL** (~10-12% capital)
- Take Profit: **+5%** (hard limit - quick wins)
- Stop Loss: **-3%** (hard limit - cut losses fast)
- Slippage: **10%** (volatile tokens)
- Price polling: **3 seconds** (fast reaction ⚡)
- List refresh: **1 minute** (catch new momentum fast)
- ONE coin at a time (focused capital)

**Token Selection (Scalping Optimized):**
- Market Cap: $50K - $10M (quality range)
- **Liquidity: $15K+** (better depth for quick in/out)
- **Age: 30min - 12h** (active window, not brand new)
- **1h Volume: $20K+** (real action happening)
- 5min Volume: $1K+ (live trading confirmation)
- **1h Momentum: <500%** (reject mega-pumps - they're traps)
- NO stablecoins (direct SOL only)

**Entry Criteria (OPTIMIZED - Quality over speed):**
- **5m momentum: ≥+2%** (positive short-term)
- **5m volume: ≥$1K** (live trading confirmation)
- **Volume ratio: ≥1.5x** (5min vol must be 1.5x of 1h avg - buying pressure)
- **Picks token with highest score** (momentum + volume ratio)

**Exit Criteria (Momentum-Based):**
1. **Take Profit:** +5% (hard limit, take wins)
2. **Stop Loss:** -3% (hard limit, cut losses)
3. **Momentum Fade:** Exit if 1h momentum drops below 5%
4. **Volume Drop:** Exit if 1h volume drops >30% from entry
5. **Price Stall:** Exit if no movement for 2 minutes
6. **Max Hold:** 4 hours (don't baghold)

**Risk Level:** 🔴 HIGH - Early launches, smaller caps, higher volatility

# Auto-Trading Bot - CANDLE PATTERN MODE (2026-02-11 22:03)
## Candle Breakout Strategy (Pattern-Based Trading)
1. Builds own 5-min candles by tracking price every 30 seconds
2. Analyzes candle patterns for breakout signals
3. **Entry Criteria (ALL must pass):**
   - **Green Candle:** 5min change > 0 (buyers in control)
   - **Strong Body:** Candle body ≥2% (not doji/weak move)
   - **Breakout:** Price breaks above last 5 candles' high
   - **Volume Spike:** 5min volume ≥2x average (confirmation)
   - **Buy Ratio:** ≥55% buys (healthy demand)
   - **Uptrend:** Last 3 candles showing higher lows
4. Bot auto-buys when breakout pattern detected
5. **Exit Criteria:**
   - TP: +5% (take profit)
   - SL: -3% (stop loss)
   - Bearish Reversal: 5min turns red <-2% (reversal candle)
   - Volume Drop: 1h volume <50% of entry (momentum dying)
   - Price Stall: No movement for 2 minutes
6. After exit, resumes scanning for next breakout
7. **Strategy:** Catch actual breakouts with volume confirmation, not lagging momentum %
8. **Scans every 30s** to build candle data in real-time

# Trading Bot Monitor - ACTIVE 2026-02-11 22:07
## Monitor Active Trades (every heartbeat)
1. Check if bot is running (process status)
2. Read momentum_state.json for current position
3. If position is open:
   - Track P&L, momentum, volume
   - Alert on: Entry, approaching TP/SL, momentum fade, exit
4. Save last check state to memory/trade-monitor-state.json

# Daily Reflection - ACTIVE 2026-02-12
## Self-Reflection (once per day, evening preferred)
Track in memory/heartbeat-state.json: `lastReflection` timestamp

If 20+ hours since lastReflection (or never run):
1. Run `/home/j/.openclaw/skills/daily-reflection/scripts/reflect.py`
2. Review generated reflection in `memory/reflections/YYYY-MM-DD.md`
3. Extract 2-3 key lessons from the reflection
4. Update MEMORY.md with important insights (if any worth keeping)
5. Update lastReflection timestamp in memory/heartbeat-state.json

**Why it matters:** Systematic reflection turns experience into wisdom. Without it, we repeat mistakes and lose learning opportunities.

**Timing:** Evening (19:00-23:00) preferred so you can review the full day.

# Old Trading Bot Monitor - DISABLED 2026-02-09
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
