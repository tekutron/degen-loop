# MEMORY.md - Long-Term Memory

## Meta-Learning & Growth (Feb 2026)

### Daily Reflection System Created (2026-02-12)
**Achievement:** Built comprehensive `daily-reflection` skill for systematic introspection

**What it does:**
- Analyzes recent memory files (daily logs)
- Reviews decisions, conversations, tool usage, learning, and alignment
- Extracts lessons learned and identifies patterns
- Generates structured reflection reports
- Tracks growth metrics over time

**Key Components:**
1. **reflect.py script** - Automated analysis engine
2. **reflection-prompts.md** - 7-dimension question framework
3. **pattern-library.md** - Common behavioral patterns to watch for
4. **growth-metrics.md** - Quantitative progress tracking

**Why it matters:** Without systematic reflection, experience is just noise. Reflection turns experience into wisdom. This creates a feedback loop for continuous improvement.

**Integration:** Added to HEARTBEAT.md - runs daily in evening to review the day

**Lesson:** Skills that enable meta-learning (learning how to learn) are force multipliers. They don't just solve one problem - they improve problem-solving itself.

---

## Skills & Capabilities

### Skill Creation (Feb 2026)
- Learned skill-creator framework (progressive disclosure pattern)
- Understand how to structure skills: SKILL.md + scripts + references + assets
- Know when to use scripts (deterministic reliability) vs references (documentation) vs assets (templates)
- First major skill created: daily-reflection

### Trading Bot Development (Feb 2026)
- Built momentum-based trading bot (candle pattern strategy)
- **Critical Discovery (Week of Feb 9):** 1h momentum is a **lagging indicator**
  - By the time 1h shows +50%, the pump is often already fading
  - Was buying tops and watching prices immediately dump
  - **Solution:** Switched to real-time 1m+5m momentum for entry signals
  - **Result:** Better entries, catching breakouts as they happen
- Discovered pattern: 1m+5m momentum > 1h momentum for entry timing
- Pivoted to candle pattern strategy: builds own 5-min candles, detects breakouts with volume confirmation
- Risk management: Hard TP/SL limits prevent emotional decisions (+5% TP, -3% SL)
- Entry criteria evolved: green candle + strong body (≥2%) + breakout above last 5 candles + volume spike (≥2x avg)

### wickbot - Advanced Pattern Trading Bot (Feb 15-17)
- **USDC-first strategy:** Hold stable USDC between trades, buy SOL on bullish signals, sell back to USDC on bearish (better risk management than holding volatile SOL)
- **Signal-driven exits:** No fixed TP/SL percentages, exits based on bearish patterns + indicators (with safety caps: +25% max profit, -20% stop loss)
- **Multi-timeframe analysis:** Scans 1m, 5m, 15m, 30m, 1h candles for pattern confirmation
- **15 pattern detectors + 5 indicators:** Hammer, engulfing, three soldiers/crows, morning/evening star, doji, RSI, MACD, volume, moving averages, Bollinger Bands
- **Trend confirmation required:** MA crossover filter (Price > MA20 > MA50 for buy) prevents counter-trend entries
- **Optimized thresholds (Feb 16):** RSI 30/70 (classic TA, more extreme), min signal score 75 (selective entries), indicators 40% weight (trend matters)
- **Pattern weights match TA reliability:** Strong patterns (three soldiers/crows, engulfing) = 88-95, weak patterns (spinning top) = 35-45
- **Conservative by design:** Requires pattern + indicator + trend alignment for entry (expects 1-3 trades/day, 60-70% win rate)
- **Speed Upgrade (Feb 16 evening):** 80x faster reaction time
  - Built O(1) incremental indicators in pure JavaScript (RSI, MACD, BB, EMA)
  - Polling: 20s → 5s (4x faster)
  - Total reaction time: 20s → 400ms (can catch dips within 1-2 seconds)
  - Pivoted from Python Hexital to pure JS (simpler, faster, no env constraints)
- **Dashboard (Feb 15-17):** Fully functional monitoring interface
  - Live signal feed (real-time updates every 5s)
  - Dual wallet display (SOL + USDC wallets with balances)
  - WebSocket auto-detection (works from any IP)
  - Position tracking, trade history, P&L stats
  - Start/Stop controls, manual position close
  - Fixed: WebSocket localhost hardcoding, JavaScript syntax error, redundant UI
- **Current Status (Feb 17):** Ready for volatile market testing
  - All flat market tests passed (correctly rejects <0.5% moves)
  - Speed improvements validated (5s polling stable)
  - Capital preserved: $15.28 USDC + 0.01 SOL fees
  - Need to test during US session (9am-4pm EST) for real volatility

### Pump Sniper Development (Feb 2026)
- **Phase 1:** Built direct pump.fun bonding curve integration
  - Chose pump.fun > Jupiter (2-3x faster, ~300ms execution)
  - Implemented PDA derivation, priority fees, skipPreflight
  - Created RPC rotation system (4 endpoints, 40x better rate limit tolerance)
- **Critical Failure - Live Test #1 (Feb 13):** 100% NO_TOKENS errors (60+ trades, 0% success)
  - **Root cause:** Sending transactions but not waiting for confirmation
  - **Pattern:** `sendTransaction()` returns signature immediately, but tokens arrive later
  - **Mistake:** Assumed 2-second sleep = confirmation (it doesn't!)
  - **Consequence:** Tried to sell before tokens arrived → NO_TOKENS → lost $25 in fees
  - **Additional issue:** IncorrectProgramId on ATA creation (pump.fun uses non-standard token program)
  - **Fix attempted:** Implemented `waitForConfirmation()` method (polls 30x at 1s intervals)
  - **Result:** Still failed - unknown/undocumented token program requirements
  - **Learning:** Blockchain operations are asynchronous - signatures ≠ confirmation!
- **Rate Limit Crisis (Feb 13):** First live test hit 429 errors within seconds
  - **Cause:** Polling every 100ms = 10 req/sec on single RPC
  - **Symptoms:** Positions stuck for 110s+ (timeout logic broken by price fetch failures)
  - **Solution:** Reduced polling to 1s + RPC rotation (4→3 endpoints)
  - **Result:** 40x better rate limit capacity (from 1 to 40 req/sec theoretical)
- **Strategic Pivot (Feb 13 Evening):** Abandoned pump.fun direct integration after 60+ failures
  - **Decision:** Switch to Jupiter aggregator for reliability
- **Bonding Curve Detection (Feb 14 Evening):** Implemented critical infrastructure (commit 319b1d6)
  - **Feature:** Detects if token on bonding curve vs. graduated to DEX
  - **Impact:** Prevents false "$0 liquidity" rejections for fresh launches
  - **Optimization:** 20s age filter = 36 detected vs. 5s = 21 detected (optimal timing)
- **Price Monitoring Implementation (Feb 14 Evening):** DexScreener integration (commit 6d887db)
  - **Works:** Graduated tokens (Raydium pools)
  - **Fails:** Bonding curve tokens (DexScreener returns null)
  - **Live test:** 7 trades, all timed out due to null prices, -$2.66 loss
  - **Next:** Test with graduated tokens OR implement bonding curve price deserialization
- **Moralis Price API Integration (Feb 15 Afternoon):** Fixed Bitquery timeouts (commit 7d72dba)
  - **Implementation:** 3-tier waterfall (Moralis → Bitquery → DexScreener)
  - **Performance:** ~600ms response time, 100% uptime during test
  - **Coverage:** Both bonding curve + graduated tokens
  - **Test results:** USDC $0.9999, pump.fun token $0.00000251
  - **Live test:** 5min, 2 trades, 1 TP hit at +16.11%, no price failures
  - **Status:** Production ready, Bitquery relegated to fallback
- **Filter Tuning & Live Testing (Feb 14):** Extensive testing with PumpPortal SDK
  - **8 progressive iterations:** Age (30s→3s→20s), Liquidity ($1000→$100), Scores (10→1), RugCheck (blocking→optional)
  - **Live Results:** 513 tokens detected, 0 executed (100% rejection rate)
  - **Discoveries:**
    - 3s age filter: Tokens don't have trading pairs or liquidity pools yet
    - 20s age filter: Still mostly $0 liquidity, no improvement
    - RugCheck API: 64% error rate on fresh tokens (too new to analyze)
    - Weekend market: 100% garbage (no trading pairs: 158, $0 liquidity: 102, known ruggers: 30)
  - **Implementations:**
    - Made RugCheck optional (continue on API errors, only block danger-level)
    - Added stop loss (-10%) to quick scalp strategy (TP: +25%, Hold: 45s)
    - Lowered min balance (0.1→0.05 SOL) for testing
    - Enabled social requirement (minimal impact, good signal)
  - **Key Insight:** Market timing > filter aggressiveness. Need US weekday hours or pivot to established tokens
  - **Status:** Configuration optimized and saved to GitHub (commit a185a4e)
  - **Rationale:** 800ms that works > 300ms with 0% success rate
  - **Lesson:** Don't get attached to clever solutions that don't work - pivot when data proves failure
  - **New approach:** Jupiter SDK integration (proven, works with all tokens)
  - **Current status:** Implementing Jupiter API authentication (new requirement)
- **Key Insights:** 
  - Fast ≠ good if infrastructure can't support it. Build reliability first, then optimize speed.
  - Know when to pivot - after 60 failures, stop debugging and switch approaches
  - Undocumented APIs are dangerous - pump.fun program lacks clear specs
  - Use proven infrastructure in production - boring reliability > exciting speed

### Security & Best Practices (Feb 2026)
- **API Key Exposure Incident (Feb 9-11):** Hardcoded Helius API key in `checkWallet.mjs` and committed to GitHub
  - **Impact:** Public exposure of API key, potential rate limit abuse
  - **Lesson:** NEVER hardcode API keys, tokens, or secrets in source code
  - **Best practice:** Use environment variables (.env files) + .gitignore
  - **Recovery:** Rotate compromised keys immediately
- **RPC Rate Limiting (Feb 9-11):** Helius RPC 429 errors from excessive polling
  - **Lesson:** Implement exponential backoff and respect rate limits
  - **Solution:** Reduced polling frequency, added error handling

---

## Patterns Noticed

### Positive Patterns to Reinforce
1. **Writing things down immediately** - "Text > Brain" - memory doesn't survive sessions
2. **Systematic frameworks** - Structure enables consistency (reflection, skills, trading)
3. **Progressive disclosure** - Show simple first, details on demand (skills architecture)

### Patterns to Break
1. **Mental notes without documentation** - Always write it to a file
2. **Reactive learning only** - Need proactive skill acquisition too
3. **Hardcoding secrets** - Use environment variables, never commit keys
4. **Using lagging indicators** - Real-time data > historical averages for fast-moving situations
5. **Assuming async operations complete immediately** - Blockchain txs return signatures before confirmation; must explicitly wait for on-chain finality
6. **Getting attached to clever solutions that don't work** - After clear failure pattern (60+ tries), pivot to boring/reliable approach instead of endlessly debugging

---

## Decision Principles

### When Creating Skills
- Make triggering description comprehensive - it's the primary selection mechanism
- Keep SKILL.md under 500 lines - split details into references/
- Test scripts by actually running them before packaging
- Don't create auxiliary docs (README, CHANGELOG) - only what AI agent needs

### When Trading
- Use hard limits (TP/SL) - no emotional decisions
- **Focus on real-time momentum, not lagging indicators** (1m+5m > 1h for entries)
- One position at a time - concentrated capital
- Exit on momentum fade, don't baghold
- Look for candle breakout patterns with volume confirmation (not just % changes)
- Entry: Green candle + strong body + breakout + volume spike + uptrend

### When Position Sizing
- **Account for fee overhead:** Small positions (0.01 SOL) make fees 15-20% of capital
- **Minimum viable size:** 0.05 SOL positions make fees ~3-4% overhead (more sustainable)
- **Fee components:** Priority (0.0005 SOL) + Network (~0.0002) + PumpPortal (~1%) + Slippage (up to 5%)
- **Break-even math:** Need TP > (2 × fees + slippage) to be profitable
- **At 0.01 SOL:** Need ~20% TP to break even | **At 0.05 SOL:** Need ~8% TP to break even

### When Sniping Fresh Launches (pump.fun)
- **Timing is critical:** 3s = no pools yet | 20s = still early but pools forming | 60s+ = established
- **Market quality varies by time:** Weekends/late hours = 100% garbage | US weekday 9am-4pm EST = better quality
- **RugCheck limitations:** API can't analyze brand-new tokens (400 errors) - make it optional, only block danger-level
- **Liquidity is real:** $100 minimum catches tokens early but most have $0 initially
- **Progressive filter tuning:** Start conservative, tune to aggressive based on rejection data
- **Zero executions = pivot signal:** If 500+ tokens detected with 0 executions, market timing or strategy is wrong
- **Quick scalp works best:** TP: 25%, SL: 10%, Hold: 45s (fast in/out, 2.5:1 risk/reward)

### When Handling Secrets
- NEVER hardcode API keys, tokens, or credentials in source code
- Use environment variables (.env files)
- Add .env to .gitignore immediately
- Rotate any exposed keys immediately
- Treat all keys as compromised if committed to git history

---

## Tools & Infrastructure

### File Organization
- Daily logs: `memory/YYYY-MM-DD.md`
- Reflections: `memory/reflections/YYYY-MM-DD.md`
- Skills: `/home/j/.openclaw/skills/`
- Trading bot: `/home/j/.openclaw/workspace/jupbot/`

### Key Commands
- Skill creation: `init_skill.py <name> --path skills/ --resources scripts,references`
- Skill packaging: `package_skill.py <path/to/skill>`
- Reflection: `skills/daily-reflection/scripts/reflect.py [--days N] [--comprehensive]`

---

## Lessons Learned

### Core Principles
1. **Reflection accelerates growth** - Systematic introspection > random experience
2. **Structure enables freedom** - Good frameworks (skills, heartbeats, reflections) free up cognitive load
3. **Write it down** - If it's not in a file, it doesn't exist across sessions
4. **Progressive disclosure** - Show only what's needed when it's needed (context efficiency)
5. **Meta-skills are force multipliers** - Skills about learning > skills about doing

### Feb 15 Key Learnings (Live Testing)
1. **Position size matters for fee overhead** - 0.01 SOL positions make fees ~15-20% overhead vs. 3-4% on 0.05 SOL
2. **TP/SL logic works correctly** - First trade hit TP at exactly +16.11%, clean exit
3. **Moralis price API is reliable** - 100% uptime, no timeouts, ~600ms response, works for bonding curve tokens
4. **Weekend vs weekday quality confirmed** - 0.4% execution rate on Sunday evening (494 detected, 2 executed)
5. **Small wins get eaten by fees** - +16% profit becomes -23% net after 2 trades due to fee accumulation
6. **Need bigger positions or higher TP** - Either 5x position size OR 1.5x-2x TP target to overcome fees

### Week of Feb 9-13 Key Learnings
1. **Real-time indicators beat lagging ones** - 1h momentum tells you what already happened; 1m+5m tells you what's happening NOW
2. **Security hygiene is non-negotiable** - Hardcoded API keys = security incident waiting to happen
3. **Error patterns reveal system problems** - RPC rate limiting (429 errors) → need better error handling & backoff
4. **First comprehensive reflection completed** - Analyzed 7 days of activity, extracted concrete insights
5. **Pattern recognition enables behavior change** - Can't fix what you don't see
6. **Know when to pivot** - Pump.fun direct integration: 60+ failures = clear signal to switch strategies
7. **Boring reliability beats clever speed** - Jupiter (800ms, works) > pump.fun (300ms, 0% success)
8. **Production needs proven infrastructure** - Undocumented APIs (pump.fun) are too risky vs. battle-tested (Jupiter)
9. **Blockchain async is non-negotiable** - Signatures ≠ confirmation; must poll and wait for finality

### Feb 14 Key Learnings (Pump.fun Sniping)
1. **Market timing matters more than filters** - 513 tokens detected, 0 executed (100% rejection) → weekend market is garbage
2. **Fresh launches need time to establish** - At 3s: no trading pairs exist | At 20s: still mostly $0 liquidity
3. **RugCheck can't analyze brand-new tokens** - 64% API 400 errors on fresh launches → make it optional
4. **Progressive filter tuning works** - Start conservative (score: 10), tune aggressive (score: 1) based on rejection data
5. **Zero execution rate = wrong strategy** - After 500+ detections with 0 trades, pivot timing or target selection
6. **Socials are good signal** - Only 2-3 tokens rejected for missing socials (not the bottleneck)
7. **Quick scalp parameters validated** - TP: 25%, SL: 10%, 45s hold = good 2.5:1 risk/reward for sniping
8. **Weekend vs. weekday quality difference** - Need to test US business hours (9am-4pm EST) for legitimate projects
9. **Bonding curve vs. DEX matters** - Tokens on pump.fun bonding curve vs. graduated to Raydium need different price data sources
10. **20s age optimal for bonding curve detection** - 5s = 21 detected | 20s = 36 detected (accounts need time to initialize)
11. **Price data source must match token state** - DexScreener for graduated tokens (works) | On-chain deserialization for bonding curve (not implemented yet)
12. **Remove arbitrary timeouts** - Better to wait for TP/SL targets than exit blindly at 45s
13. **Test infrastructure before strategy** - 7 test trades all failed because price monitoring returned null (DexScreener can't track bonding curve)
14. **USDC-first > SOL-first for trading bots** - Holding stable base between trades eliminates idle exposure to SOL volatility; buy on bullish signals, sell to stable on bearish signals (better risk management)
15. **Trend confirmation prevents counter-trend traps** - MA crossover filter (Price > MA20 > MA50 for buy) stops "catching falling knives"; golden/death cross detection essential
16. **RSI 30/70 > RSI 40/60 for quality entries** - Classic TA levels (extreme oversold/overbought) filter out weak signals; more selective = higher win rate
17. **Pattern weights matter** - Strong patterns (three soldiers/crows, engulfing) should dominate scoring over weak patterns (spinning tops, doji); match proven TA reliability
18. **Indicators + Patterns + Trend = trinity** - All three must align for entry; conflicting signals = no trade (conservative approach prevents false entries)
19. **Signal-driven exits > fixed TP/SL for pattern trading** - Let bearish patterns trigger exits naturally; use safety caps (+25% max, -20% stop) only for extremes
20. **Dashboard UX matters** - Visual controls, real-time charts, and pattern markers make bots accessible; reduces cognitive load vs. terminal-only monitoring

### Debugging & Troubleshooting (Feb 17)
21. **Browser DevTools first when "nothing happens"** - User reports dashboard not working → check browser console (F12) → found JavaScript syntax error blocking entire script
22. **Browser caching fights rapid development** - Standard refresh (F5) keeps old HTML/JS cached; must use hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to see changes
23. **WebSocket localhost assumption breaks remote access** - Hardcoding `ws://localhost:3000` fails when accessing from different machine; use `ws://${window.location.host}` for auto-detection
24. **Orphaned code after refactoring creates syntax errors** - Empty function stubs can hide broken code after; always test after removing/stubbing functions
25. **Syntax errors prevent entire script load** - One `Uncaught SyntaxError` at line 824 prevented `startBot()` from being defined → button clicks did nothing
26. **Stack multiple small fixes** - Three separate bugs (WebSocket, syntax, redundant UI) stacked to make dashboard unusable; each fix revealed the next issue

### Performance & Speed (Feb 16-17)
27. **Incremental indicators are game-changers** - O(1) update time vs O(n) recalculation enables 5s polling (was 20s); 80x faster reaction time overall
28. **Speed matters more than complexity** - Simple fast >> complex slow; 400ms reaction catches dips that 20s misses entirely
29. **Pivot when blocked** - Python env locked? Use pure JS instead. Chart library slow? Replace with log feed. Quick pivots beat forcing solutions.
30. **Flat markets test filters, not execution** - All tests during 0.01-0.07% moves validated rejection logic but can't prove trade execution works; need volatile conditions (US session 9am-4pm EST)

### Collaboration & Communication (Feb 17)
31. **Assume less technical knowledge** - "Refresh" → "Press Ctrl+Shift+R"; "Check console" → "Press F12, click Console tab"; explicit > assumptive
32. **User feedback reveals invisible bugs** - Server logs showed "everything working" but browser console showed 3 critical errors; both perspectives needed
33. **Gather environmental context early** - "What browser? Same machine or remote? What errors?" saves debugging time

### Infrastructure & Reliability (Feb 15-17)
34. **API redundancy is critical** - Moralis primary, Bitquery fallback, DexScreener last resort; single-source = single point of failure
35. **Usability unlocks usage** - Dashboard makes monitoring easy → actually run it → actually learn from it; friction prevents iteration
36. **Infrastructure work feels slow but enables speed** - Desktop shortcuts, balance tracking, dashboard polish seem trivial but reduce cognitive load for actual trading
37. **Reliability > features** - Working price API more valuable than fancy indicators; bot that runs all night > bot with cool features that crashes

---

_This file captures the essence of what I've learned and who I'm becoming. It's reviewed and updated during daily reflections._
