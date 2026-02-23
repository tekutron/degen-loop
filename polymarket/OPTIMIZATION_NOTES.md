# Polymarket Bot Optimization Notes

Based on research into successful 5-minute trading bots:

## Current Issues

### 1. **Latency (Critical)**
- **Problem:** Using REST polling every 10s
- **Impact:** Missing fast-moving opportunities in 5-minute windows
- **Solution:** Switch to WebSocket for real-time orderbook updates
- **Reference:** discountry/polymarket-trading-bot uses WebSocket via MarketWebSocket class

### 2. **Price Data Source**
- **Problem:** Using CoinGecko (can have 30s+ lag)
- **Impact:** Stale momentum signals
- **Solution:** Use Polymarket's CLOB API for real-time mid-price
- **Reference:** CLOB provides live orderbook bid/ask spreads

### 3. **RPC Performance**
- **Problem:** Using public Polygon RPC
- **Impact:** Rate limits, slower confirmations
- **Solution:** Switch to Alchemy or QuickNode for low-latency Polygon access
- **Cost:** ~$50-100/month for premium tier

### 4. **Taker Fees**
- **Problem:** Not accounting for taker fees (eat into edge)
- **Impact:** Profitable signals become unprofitable after fees
- **Solution:** 
  - Focus on maker orders (place limit orders, not market)
  - Only bet when edge > fee + spread
  - Calculate true expected value after costs

### 5. **Momentum Detection**
- **Problem:** Estimating 5m momentum from 1h data (inaccurate)
- **Impact:** Low confidence predictions (50%)
- **Solution:** Build real 5-minute candles from tick data
- **Reference:** Track price every 10-30s within the window

## Recommended Enhancements

### Phase 1: WebSocket Integration (High Priority)
```javascript
// Use Polymarket's WebSocket for real-time orderbook
// From discountry bot: MarketWebSocket class
// Benefits: <100ms updates vs 10s polling
```

### Phase 2: CLOB Price Data (High Priority)
```javascript
// Get live mid-price from CLOB API
// https://clob.polymarket.com/midpoint?token_id=<token_id>
// More accurate than CoinGecko for 5m windows
```

### Phase 3: Real 5-Min Candles (Medium Priority)
```javascript
// Poll price every 30s during market window
// Build actual 5-min candle (open/high/low/close)
// Detect patterns: strong green candle, breakouts, etc.
```

### Phase 4: Fee-Aware Betting (Medium Priority)
```javascript
// Calculate true edge after fees
// Taker fee on short-term markets: ~2-3%
// Only bet if: edge - fees - spread > min_threshold (e.g., 5%)
```

### Phase 5: Maker Strategy (Advanced)
```javascript
// Place limit orders instead of market orders
// Wait for fills (no taker fee)
// Requires: Order management, cancel if not filled, etc.
```

## Alternative Approaches

### Use Official Polymarket Agents Framework
- **Repo:** https://github.com/Polymarket/agents
- **Benefits:** 
  - Built by Polymarket team
  - Proper WebSocket integration
  - Order management built-in
- **Drawback:** Python (we're using JS)
- **Decision:** Could port or run alongside

### Copy Discountry Bot Architecture
- **What it does well:**
  - WebSocket orderbook streaming
  - Flash crash detection (sudden prob drops)
  - Gasless transactions (via Builder Program)
- **Adaptation:** Port WebSocket logic to our JS bot

### Try Rust Bot (Follow-Gabagool22)
- **Benefits:** 
  - Built specifically for 5m BTC
  - Ultra-low latency
  - Position management
- **Drawback:** Rust (harder to modify)
- **Decision:** Study strategy, implement in JS

## Current Bot Status

**Working:**
- ✅ Market discovery via Gamma API
- ✅ Finding 4 active 5m markets (BTC/ETH/SOL/XRP)
- ✅ Momentum analysis
- ✅ Simulation mode ($100 virtual)

**Needs Improvement:**
- ❌ WebSocket (currently REST polling)
- ❌ Real-time price data (using CoinGecko, 30s+ lag)
- ❌ Accurate 5m momentum (estimating from 1h)
- ❌ Fee calculation (not factored in)

**Result:** Bot skips all bets (50% confidence too low)

## Next Steps (Priority Order)

1. **Add WebSocket price tracking** (biggest impact)
2. **Use CLOB mid-price** instead of CoinGecko
3. **Build real 5m candles** from tick data
4. **Add fee-aware edge calculation**
5. **Test on next volatile market window**

## Timeline

- **Quick fix (30 min):** Switch to CLOB mid-price
- **Medium fix (2 hours):** Add WebSocket streaming
- **Full optimization (1 day):** Complete rewrite using discountry architecture

## Risk Note

**Current conservative approach is GOOD for testing:**
- Bot correctly identifies flat markets (50% confidence)
- Not betting on coin flips (50/50)
- Waiting for actual edge

**Once optimizations complete:**
- Should see 65-75% confidence on strong moves
- Will place bets on clear momentum
- Expected win rate: 55-65% (if strategy works)
