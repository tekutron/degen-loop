# Trading Bot Startup Checklist

**Use this checklist every time you start the trading bot!**

## Pre-Start Checklist

### 1. ⚠️ Enable Scheduled Refresh (DISABLED 2026-02-12)
```bash
# Set up 10-minute auto-refresh:
(crontab -l 2>/dev/null; echo "*/10 * * * * cd /home/j/.openclaw/workspace/jupbot && node refreshTrending.mjs >> refresh.log 2>&1") | crontab -

# Verify it's running:
crontab -l | grep refreshTrending
```

**Why?** Bot needs fresh token list every 10 minutes to catch new opportunities.

### 2. Check Wallet Balance
```bash
cd /home/j/.openclaw/workspace/jupbot
node checkWallet.mjs
```

**Minimum:** 0.1 SOL (for trading + fees)

### 3. Review Current Filters (v2.0 Optimized)
- ✅ Mega-pump filter: <500% 1h momentum
- ✅ Volume ratio: ≥1.5x required
- ✅ Liquidity: $15K+ minimum

### 4. Manual Refresh Token List
```bash
cd /home/j/.openclaw/workspace/jupbot
node refreshTrending.mjs
```

Check if any tokens passed filters. If 0, that's OK (bot will wait).

### 5. Start Bot
```bash
cd /home/j/.openclaw/workspace/jupbot
MAIN_WALLET=1 node momentumCycleFixed.mjs
```

## Post-Start Checklist

### 6. Verify Bot is Running
```bash
ps aux | grep momentumCycleFixed | grep -v grep
```

Should show process ID.

### 7. Monitor First Few Minutes
Watch console output for:
- ✅ "Scanning X tokens..."
- ✅ Entry criteria checks
- ⚠️ Any errors

### 8. Check State File
```bash
cat jupbot/momentum_state.json | grep -E "running|stage"
```

Should show: `"running": true` and `"stage": "IDLE"` or `"BUY"`

## During Trading

### Monitor Active Trades
Check every 30-60 minutes:
```bash
cat jupbot/momentum_state.json
```

Look for:
- Current position (if any)
- P&L percentage
- Entry/exit prices

### Check Balance Periodically
```bash
node checkWallet.mjs | grep "SOL Balance"
```

Track progress toward 1.0 SOL goal.

## Shutdown Checklist

### 1. Stop Bot Gracefully
```bash
pkill -f "momentumCycleFixed.mjs"
```

Wait 5 seconds for graceful shutdown.

### 2. Disable Scheduled Refresh (Optional)
```bash
# Remove cron job:
crontab -l | grep -v "refreshTrending" | crontab -
```

**Why?** Saves resources when not trading.

### 3. Check Final Balance
```bash
node checkWallet.mjs
```

### 4. Update Balance Tracking
```bash
# Add checkpoint to memory/wallet-tracking.json
# Record: date, balance, session P&L
```

---

**Last Update:** 2026-02-12 18:33 PST  
**Status:** Scheduled refresh DISABLED (re-enable before starting bot)
