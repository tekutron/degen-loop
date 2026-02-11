# HEARTBEAT.md

## Trading Workflow (Aggressive Momentum Scalping)
**Strategy:** Smaller positions, tighter stops, focus on fresh momentum

**After each trade completes:**
1. Refresh trending list: `cd /home/j/.openclaw/workspace/jupbot && node refreshTrending.mjs`
2. Scan for: newest coins + strongest 5m/1h momentum (prioritize fresh launches)
3. Enter position: **0.03-0.04 SOL** (~5-8% capital)
4. Monitor for TP (+5%) or **SL (-1.5%)** - STRICT
5. Exit immediately if momentum stalls or reverses
6. Repeat workflow

**Exit criteria:**
- **TP:** +5% (let winners run)
- **SL:** -1.5% (cut losers fast!)
- Exit early if: 5m momentum goes negative OR price stalls >3 minutes
- Fresh tokens each trade = chase the hottest momentum

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
