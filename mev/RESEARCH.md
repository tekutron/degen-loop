# MEV Bot Research

## Solana MEV Landscape

**Key Differences from Ethereum:**
- No public mempool (transactions go direct to leader)
- Jito Labs provides MEV infrastructure
- Bundles allow atomic transaction execution
- Lower MEV opportunities but less competition

## Viable Strategies for First Win

### 1. Cross-DEX Arbitrage (EASIEST)
**How it works:**
- Monitor price differences between Jupiter, Raydium, Orca
- Buy on cheap DEX, sell on expensive DEX
- Profit = price difference - fees

**Pros:**
- No front-running needed
- Lower competition
- Can use existing Jupiter API

**Cons:**
- Small profit margins (1-3%)
- Need to be FAST
- Arbitrage gets eaten quickly

### 2. Sandwich Attacks (HARDER)
**How it works:**
- Detect large pending swap
- Front-run: Buy before their trade
- Their trade pushes price up
- Back-run: Sell after their trade
- Profit = price impact

**Pros:**
- Larger profit potential
- Proven strategy on Solana

**Cons:**
- Need Jito bundles
- Ethical concerns
- Higher complexity

### 3. Token Launch Sniping (FASTEST)
**How it works:**
- Monitor pump.fun for new launches
- Be in first 5-10 buys
- Sell into the hype pump
- Profit = early entry advantage

**Pros:**
- Clear opportunity
- High profit potential
- No MEV infrastructure needed

**Cons:**
- Many bots competing
- Need sub-second execution
- Risk of rugs

## Recommendation: START WITH ARBITRAGE

**Why:**
- Simplest to implement
- Uses existing Jupiter API
- No ethical issues
- Repeatable

**Plan:**
1. Build scanner to find price differences
2. Execute trades when spread > fees
3. Monitor for 1 hour
4. Capture first profitable arbitrage

**Expected profit:** $0.50 - $5 per trade
**Win condition:** 1 net positive trade
