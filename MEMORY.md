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

### Week of Feb 9-12 Key Learnings
1. **Real-time indicators beat lagging ones** - 1h momentum tells you what already happened; 1m+5m tells you what's happening NOW
2. **Security hygiene is non-negotiable** - Hardcoded API keys = security incident waiting to happen
3. **Error patterns reveal system problems** - RPC rate limiting (429 errors) → need better error handling & backoff
4. **First comprehensive reflection completed** - Analyzed 7 days of activity, extracted concrete insights
5. **Pattern recognition enables behavior change** - Can't fix what you don't see

---

_This file captures the essence of what I've learned and who I'm becoming. It's reviewed and updated during daily reflections._
