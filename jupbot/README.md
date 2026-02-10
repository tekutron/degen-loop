# Solana Trading Bot

Automated trading bot for Solana SPL tokens using Raydium pools and Jupiter Ultra Swap API.

## Features

- **Multi-DEX Aggregation**: Raydium (CLMM, CPMM, AMM v4) + Jupiter Ultra API
- **Auto-Refreshing Hot Trending**: Updates every 1 minute with fresh trending memes from DexScreener for aggressive scalping
- **Conservative Scalping**: 3% take profit, 0.5% stop loss, 1% slippage for tight risk management
- **Automated Trading**: Buy → Monitor → TP/SL exit cycle with sub-10s monitoring
- **Jupiter Ultra API**: Next-gen swap aggregation with sub-second landing via Jupiter Beam
- **Priority Fees**: 0.001 SOL per transaction for faster confirmation
- **Web UI**: Real-time dashboard with active trades, completed history, and live trending tokens

## Architecture

### Trading Engine
- **degenCycle.mjs**: Main trading loop (fetch trending → buy → monitor → sell)
- **sdkSwap.mjs**: Universal swap executor (Raydium SDK + Jupiter Ultra API)
- **liquidateAll.mjs**: Emergency exit all positions to wSOL

### Jupiter Ultra API Integration

This bot uses **Jupiter Ultra Swap API** (v1) which provides:
- **Meta-aggregation** across multiple sources (Iris, DFlow, OKX, JupiterZ RFQ)
- **Best executed price** with predictive execution and slippage-aware routing
- **Sub-second transaction landing** via Jupiter Beam proprietary engine
- **Automatic priority fee optimization** with Real-Time Slippage Estimator (RTSE)
- **MEV protection** with complete transaction privacy until on-chain execution

**Migration from V6**: Jupiter deprecated the v6 quote API (`quote-api.jup.ag`) in favor of Ultra API (`api.jup.ag/ultra/v1/order`). This bot now exclusively uses Ultra API.

## Setup

### Prerequisites

```bash
node >= 18
npm
```

### Installation

```bash
cd jupbot
npm install
```

### Configuration

1. **Create `.env` file:**

```bash
cp .env.example .env
```

2. **Required environment variables:**

```env
# RPC endpoint (Helius recommended for reliability)
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Jupiter API key (get from https://portal.jup.ag)
JUPITER_API_KEY=your-jupiter-api-key

# 0x API key (optional, for additional liquidity sources)
ZEROX_API_KEY=your-0x-api-key

# Wallet path
SWAP_WALLET=./wallets/generated_keypair.json
```

3. **Generate a trading wallet:**

```bash
node scripts/generate_wallet.js
```

This creates `wallets/generated_keypair.json`. **Fund it with SOL** before trading.

### Bot Configuration

Edit `.env` file for trading parameters:

```env
SIZE_SOL=0.05              # Trade size per token (minimum 0.05 SOL for Ultra API)
SLIPPAGE_BPS=50            # Slippage tolerance (0.5%)
TAKE_PROFIT_PCT=3          # Take profit % (3%)
STOP_LOSS_PCT=0.5          # Stop loss % (0.5%)
PRICE_POLL_MS=10000        # Price check interval (10s)
TRENDING_REFRESH_MS=60000  # Trending list refresh (1 min - aggressive scalping)
```

**Current Strategy:**
- **Aggressive scalping**: Ultra-fast 3% profits, very tight 0.5% stop loss
- **Ultra-low slippage**: 0.5% tolerance for precise execution
- **Rapid cycles**: 1-minute token refresh, 5-minute max hold time per position

**Important**: Jupiter Ultra API has a **minimum trade size of ~0.05 SOL**. Lower amounts will fail with "Insufficient funds" or "Route not found".

## Usage

### Start Trading Bot

```bash
# Run in foreground
node degenCycle.mjs

# Run in background
nohup node degenCycle.mjs > cycle.log 2>&1 &
```

### Check Wallet Balance

```bash
node checkWallet.mjs
```

### Test a Swap

```bash
# Edit testSwap.mjs to configure test parameters
node testSwap.mjs
```

### Liquidate All Positions

```bash
# Emergency exit: sell all SPL tokens to wSOL
MAIN_WALLET=1 node liquidateAll.mjs
```

### Unwrap wSOL to Native SOL

```bash
# Convert wrapped SOL to native SOL for transaction fees
node unwrapSol.mjs
```

### Refresh Hot Trending List (Manual)

```bash
# Fetch fresh trending memes from DexScreener
node refreshTrending.mjs
```

**Auto-refresh**: The trending list updates automatically every 1 minute via OpenClaw cron job. This ensures the bot always trades the hottest trending memes with aggressive scalping frequency.

**Criteria:**
- Min $100K 24h volume
- Min $20K liquidity
- **Tier 2 (Stable)**: $500K+ volume, $50K+ liquidity, <100% 24h swing
- **High Risk**: Everything else meeting minimums
- **Target mix**: 60% Tier 2 / 40% High Risk (9 + 6 = 15 tokens)

## Priority Fees

The bot adds a **0.001 SOL (1,000,000 lamports)** priority fee to all Jupiter swaps for faster confirmation. This is hardcoded in `sdkSwap.mjs`:

```javascript
priorityFeeLamports: 1000000  // 0.001 SOL
```

To adjust, modify the `getJupiterQuote` calls in `sdkSwap.mjs`.

## Web Dashboard

A Next.js web app displays:
- Active trades with entry/exit prices, P&L
- Top volume coins being traded (1h Raydium)
- Real-time position tracking

Located in `/apps/web` (separate repo: `tekutron/degen-loop`).

## API Endpoints

### Jupiter Ultra API

**Base URL**: `https://api.jup.ag/ultra/v1`

**Get Order (Quote + Transaction)**:
```
GET /order?inputMint={mint}&outputMint={mint}&amount={lamports}&slippageBps={bps}&mode=ExactIn&taker={wallet}&prioritizationFeeLamports={lamports}
```

Response includes:
- `transaction`: Base64-encoded versioned transaction (ready to sign)
- `inAmount`, `outAmount`: Trade amounts
- `routePlan`: Liquidity sources used
- `prioritizationFeeLamports`: Priority fee included

**Headers**:
```
x-api-key: YOUR_JUPITER_API_KEY
```

### Raydium Trade API

**Compute Swap**:
```
GET https://transaction-v1.raydium.io/compute/swap-base-in
```

Used for CLMM/CPMM pool routing when available.

## Troubleshooting

### "Route not found"

**Cause**: Trade size too small or insufficient liquidity.

**Fix**: 
- Increase `sizeSol` to at least 0.05 SOL
- Check token liquidity on DexScreener

### Transaction timeout (30s)

**Cause**: Network congestion or insufficient priority fee.

**Fix**:
- Increase priority fee in `sdkSwap.mjs` (e.g., to 2,000,000 lamports)
- Use a better RPC endpoint (Helius, Triton, QuickNode)

### "Insufficient funds" (Ultra API)

**Cause**: Wallet doesn't have enough SOL/tokens, or trade size below minimum.

**Fix**:
- Fund wallet with more SOL
- Increase trade size to ≥0.05 SOL
- Unwrap wSOL to native SOL: `node unwrapSol.mjs`

## File Structure

```
jupbot/
├── degenCycle.mjs          # Main trading loop
├── sdkSwap.mjs             # Swap execution (Raydium + Jupiter Ultra)
├── liquidateAll.mjs        # Emergency exit
├── unwrapSol.mjs           # wSOL → native SOL converter
├── checkWallet.mjs         # Balance checker
├── testSwap.mjs            # Swap testing utility
├── cycle_state.json        # Bot config + runtime state
├── positions.json          # Open positions tracker
├── wallets/
│   └── generated_keypair.json
└── scripts/
    └── generate_wallet.js
```

## Development

### Key Changes from V6 → Ultra API

1. **Endpoint**: `quote-api.jup.ag/v6/quote` → `api.jup.ag/ultra/v1/order`
2. **Response**: Separate quote + swap calls → Single order response with transaction
3. **Transaction**: Legacy + Versioned support → Versioned only (V0)
4. **Priority fees**: Manual compute budget → Built-in `prioritizationFeeLamports` param
5. **Swap instructions**: Supported → Not supported (transaction pre-built)

### Transaction Flow (Ultra API)

```
1. GET /ultra/v1/order → Returns quote + base64 transaction
2. Deserialize as VersionedTransaction
3. Sign with wallet keypair
4. sendRawTransaction with maxRetries + preflightCommitment
5. confirmTransaction
```

## Contributing

This is a personal trading bot. Use at your own risk. No warranty or support provided.

## License

MIT

## Disclaimer

**Trading cryptocurrencies carries risk**. This bot is experimental software. Only trade amounts you can afford to lose. Always test on devnet first. Not financial advice.
