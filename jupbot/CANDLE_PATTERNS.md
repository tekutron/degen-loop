# Candle Pattern Trading for Meme Coins

## What We Can Do

DexScreener provides OHLCV data (Open, High, Low, Close, Volume) for multiple timeframes:
- 5-minute candles
- 15-minute candles  
- 1-hour candles
- 4-hour candles
- Daily candles

We can analyze:

### 1. **Candle Patterns**
- **Bullish Engulfing**: Big green candle engulfs previous red candle (reversal signal)
- **Bearish Engulfing**: Big red candle engulfs previous green candle (dump signal)
- **Doji**: Small body, long wicks (indecision - wait for breakout)
- **Hammer**: Long lower wick, small body (buyers stepping in)
- **Shooting Star**: Long upper wick, small body (sellers rejecting higher prices)
- **Morning Star / Evening Star**: 3-candle reversal patterns

### 2. **Price Action**
- **Higher Highs / Higher Lows**: Uptrend confirmation
- **Lower Highs / Lower Lows**: Downtrend (stay out)
- **Support/Resistance**: Price bouncing off levels
- **Breakouts**: Price breaking through resistance with volume

### 3. **Volume Analysis**
- **Volume Spike**: Large volume candle = strong move
- **Volume Decline**: Momentum fading
- **Volume at Support**: Buyers stepping in = good entry
- **Volume at Resistance**: Breakout confirmation

### 4. **Indicators** (can calculate from OHLCV)
- **Moving Averages**: 20-period MA for trend
- **RSI**: Overbought (>70) / Oversold (<30)
- **MACD**: Momentum shifts
- **Bollinger Bands**: Volatility and breakouts

## Strategy Example: "Candle Breakout Scalper"

**Entry Criteria:**
1. **5-min candle breaks above recent high** (breakout)
2. **Volume on breakout candle is 2x+ average**
3. **Previous 3 candles show higher lows** (uptrend forming)
4. **No long upper wicks** (not rejection)
5. **1-hour trend is up** (overall bullish context)

**Exit Criteria:**
1. **Bearish engulfing candle** (reversal)
2. **Price closes below 20-period MA** (trend break)
3. **Volume dies** (<50% of entry volume)
4. **+5% TP or -3% SL** (still use hard limits)

## Advantages vs Current Approach

**Current (Momentum %)**
- ✅ Simple, fast
- ❌ Lagging - catches moves late
- ❌ No context of WHERE price is
- ❌ No trend analysis

**Candle Patterns**
- ✅ Visual confirmation of strength
- ✅ Catches moves early (breakouts)
- ✅ Context of support/resistance
- ✅ Trend confirmation
- ❌ More complex to implement
- ❌ Needs historical data

## Implementation Plan

1. **Fetch OHLCV data** from DexScreener (they have this in their API)
2. **Build pattern recognition functions** (engulfing, hammer, etc.)
3. **Calculate support/resistance levels** from recent highs/lows
4. **Add volume confirmation** (breakout volume must be strong)
5. **Combine with our existing filters** (liquidity, age, etc.)

## Quick Start: Simple Candle Strategy

Instead of complex patterns, we can start with:

**"Strong Green Candle Breakout"**
- Last 5-min candle is GREEN (close > open)
- Last candle's close is ABOVE previous 5 candles' highs (breakout)
- Last candle's volume is 2x+ average volume
- Body size > 2% (strong move, not doji)
- No long upper wick (<25% of candle range)

This catches strong breakout moves with volume confirmation, not just "momentum %" which can be lagging.

Want me to build this?
