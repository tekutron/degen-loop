# Updated Trading Strategy - Swing Trading

## Changes from Previous (Scalping)

**OLD (Failed):**
- Scalping with 0.03 SOL positions
- -1.5% stop loss (didn't trigger fast enough)
- Fresh launches (<3h old) with extreme volatility
- 10 second price polling
- Multiple tokens in rotation

**NEW (Swing Trading):**
- Swing trading with 0.05-0.1 SOL positions
- -3% stop loss (more realistic for volatility)
- Established coins (6-48h old, proven volume)
- 3 second price polling (faster reaction)
- ONE position at a time (no rotation until closed)

## Strategy Parameters

### Position Sizing
- **Size:** 0.05-0.1 SOL per trade (~10-20% of capital)
- **Max positions:** 1 (focus on single coin)

### Entry Criteria
- **Volume:** $500K+ in 24h (good liquidity)
- **Liquidity:** $30K+ (can exit without slippage)
- **Age:** 6-48 hours (established, not brand new pumps)
- **Momentum:** Strong 1h + 6h trends (sustained moves)
- **Market Cap:** $100K - $5M (sweet spot for swings)

### Exit Criteria
- **Take Profit:** +10% (let winners run longer)
- **Stop Loss:** -3% (realistic for volatile memes, STRICT)
- **Trailing Stop:** Consider if +8% gained
- **Max Hold Time:** 4 hours (don't baghold)

### Technical Monitoring
- **Price Polling:** Every 3 seconds (fast reaction)
- **Volume Check:** Watch for volume drop = exit early
- **Candle Analysis:** Watch for reversal patterns
- **Momentum Shift:** Exit if 5m momentum goes negative

## Stablecoin Handling
- **NEVER route through stablecoins** (USDC/USDT/USD1/USDH)
- Direct SOL → Token → SOL routes only
- Filter out any stablecoin from trending list

## Token Selection Process

1. **Pull from DexScreener** (boosts API)
2. **Filter for swing-friendly tokens:**
   - Age: 6-48h (proven trending)
   - Volume 24h: $500K+ (liquid)
   - Liquidity: $30K+ (can exit)
   - Price stability: Not +1000% pumps (too risky)
   - Volatility: 20-200% in 24h (good swings, not insane)
3. **Rank by momentum score:**
   - Volume consistency (1h/24h ratio)
   - Sustained uptrend (6h + 24h both positive)
   - Transaction count (real activity)
4. **Trade TOP 5-10 tokens** (rotate one at a time)

## Execution Flow

1. **Select coin** from filtered list (top momentum)
2. **Buy** with 0.05-0.1 SOL
3. **Monitor** every 3 seconds:
   - Check TP (+10%)
   - Check SL (-3%)
   - Check momentum (exit if drops)
   - Check volume (exit if dries up)
4. **Sell** on TP/SL/timeout (4h max)
5. **Wait** 30 seconds before next trade
6. **Repeat** with next coin in list

## Risk Management

- **Hard stop loss:** -3% (no exceptions)
- **Max loss per day:** -15% of capital (pause if hit)
- **Max hold time:** 4 hours (don't baghold dumps)
- **One position:** No splitting capital
- **Direct routes only:** No stablecoin routing

## Key Differences from Scalping

| Aspect | Scalping (Old) | Swing Trading (New) |
|--------|----------------|---------------------|
| Position size | 0.03 SOL | 0.05-0.1 SOL |
| Take profit | +5% | +10% |
| Stop loss | -1.5% | -3% |
| Hold time | Minutes | Up to 4h |
| Token age | 1-120h | 6-48h |
| Polling | 10s | 3s |
| Volatility | 1000%+ accepted | 20-200% preferred |
| Positions | Multiple rotation | ONE at a time |
| Focus | Fresh pumps | Established trends |

## Success Metrics

- **Win rate target:** 50%+ (realistic)
- **Risk/reward:** 1:3 ratio (3% risk for 10% gain)
- **Daily target:** +5-10% (compound over time)
- **Max drawdown:** -15% (stop trading for day)
