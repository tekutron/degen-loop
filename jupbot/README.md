# Solana Meme Token Trading Bot

Automated/manual trading bot for Solana meme tokens using Raydium SDK and Jupiter aggregation.

## Features

- **Multi-DEX Aggregation**: Raydium (CLMM, CPMM, AMM v4) + Jupiter API fallback
- **Hot Trending Tokens**: Auto-refreshing list from DexScreener (configurable interval)
- **TOKEN_2022 Support**: Detects tokens using Token Extensions Program
- **Flexible Trading Modes**: Automated cycle or manual scalping
- **Safe Swap Utilities**: Jupiter-only swap with stablecoin filters
- **Web Dashboard**: Real-time monitoring at http://localhost:3000

## Current Strategy (Manual Scalping)

**Aggressive Momentum Scalping:**
- **Position size**: 0.03-0.04 SOL (~5-8% of capital)
- **Take profit**: +5%
- **Stop loss**: -1.5% (strict!)
- **Priority fee**: 0.0001 SOL
- **Slippage**: 1% (100 bps)
- **Focus**: Fresh launches with strong 5m/1h momentum
- **Workflow**: Refresh trending after each trade → Select best momentum → Enter → Exit at TP/SL

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
# RPC endpoint (Helius recommended)
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Wallet path
SWAP_WALLET=./wallets/generated_keypair.json

# Trading parameters
SIZE_SOL=0.05              # Trade size per token
SLIPPAGE_BPS=100           # Slippage tolerance (1%)
TAKE_PROFIT_PCT=5          # Take profit % (5%)
STOP_LOSS_PCT=2            # Stop loss % (2%)
PRICE_POLL_MS=10000        # Price check interval (10s)
TRENDING_REFRESH_MS=600000 # Trending list refresh (10 min)
```

3. **Generate a trading wallet:**

```bash
node scripts/generate_wallet.js
```

This creates `wallets/generated_keypair.json`. **Fund it with SOL** before trading.

## Tools & Scripts

### Core Trading

```bash
# Start automated trading bot
node degenCycle.mjs

# Refresh trending list manually
node refreshTrending.mjs
```

### Wallet Management

```bash
# Check wallet balance (supports TOKEN_2022_PROGRAM_ID)
node checkWallet.mjs

# Sell all token positions to SOL
node sellAllTokens.mjs

# Unwrap wSOL to native SOL
node unwrapSol.mjs
```

### Swap Utilities

```bash
# Safe Jupiter-only swap (blocks stablecoins)
node safeSwap.mjs <inputMint> <outputMint> <amountLamports> [slippageBps]

# Universal swap (Raydium SDK + Jupiter fallback)
SWAP_WALLET=wallets/generated_keypair.json \
INPUT_MINT=<mint> \
OUTPUT_MINT=<mint> \
AMOUNT_LAMPORTS=<amount> \
node sdkSwap.mjs

# Sell 100% of a token
SWAP_WALLET=wallets/generated_keypair.json \
INPUT_MINT=<token_mint> \
OUTPUT_MINT=So11111111111111111111111111111111111111112 \
AMOUNT_LAMPORTS=0 \
node sdkSwap.mjs
```

## Trending Token Refresh

The bot uses DexScreener's trending API with these filters:

**Criteria:**
- Min $10K liquidity
- Min $100K 24h volume
- **Tier 2 (Prime Scalping)**: $500K+ volume, $50K+ liquidity, <100% 24h swing
- **Tier 1 (High Volatility)**: Everything else meeting minimums
- **Target mix**: 60% Tier 2 / 40% High Risk

**Auto-refresh**: Configurable via `TRENDING_REFRESH_MS` in `.env` or bot settings.

**Manual refresh:**
```bash
node refreshTrending.mjs
```

## Key Files

```
jupbot/
├── degenCycle.mjs          # Automated trading loop
├── sdkSwap.mjs             # Universal swap executor (Raydium SDK + Jupiter)
├── safeSwap.mjs            # Jupiter-only swap with stablecoin filter
├── sellAllTokens.mjs       # Bulk position cleanup
├── checkWallet.mjs         # Balance checker (TOKEN_2022 support)
├── refreshTrending.mjs     # Fetch trending tokens from DexScreener
├── unwrapSol.mjs           # wSOL → native SOL converter
├── liquidateAll.mjs        # Emergency exit all positions
├── cycle_state.json        # Bot runtime state
├── cycle_trades.json       # Trade history
├── positions.json          # Open positions
├── trending_tokens_feb9.json # Hot trending memes list
└── wallets/
    └── generated_keypair.json
```

## New Features

### TOKEN_2022_PROGRAM_ID Support

`checkWallet.mjs` now detects tokens using the Token Extensions Program (TOKEN_2022_PROGRAM_ID):

```javascript
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

// Checks both programs
const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  walletAddress,
  { programId: TOKEN_PROGRAM_ID }
);
const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
  walletAddress,
  { programId: TOKEN_2022_PROGRAM_ID }
);
```

Many newer meme tokens use TOKEN_2022 and were invisible to older wallet checkers.

### Safe Swap Utility

`safeSwap.mjs` provides Jupiter-only routing with built-in protections:

- **Blocks stablecoin purchases** (USDC, USDT, USD1, USDH)
- **Jupiter API only** (bypasses Raydium SDK issues)
- **Simple CLI interface**: `node safeSwap.mjs <input> <output> <amount> [slippage]`

**Example:**
```bash
# Sell token for SOL
node safeSwap.mjs \
  8ckfBhNvEDA62udk4YGNbSYcd5wvmQDjhY6kAYsgpump \
  So11111111111111111111111111111111111111112 \
  1000000
```

### Bulk Position Cleanup

`sellAllTokens.mjs` scans wallet and sells all non-SOL tokens:

```bash
node sellAllTokens.mjs
```

Automatically:
- Skips wSOL (wrapped SOL)
- Uses higher slippage (300 bps) for faster execution
- Reports success/failure for each token

## Web Dashboard

A Next.js dashboard displays:
- Active trades with entry/exit prices, P&L
- Completed trade history
- Live trending tokens (auto-updates every 5 min)
- Wallet positions

**Location**: `/home/j/degen-loop` (separate repo)
**Access**: http://localhost:3000

The dashboard reads JSON files from this workspace:
- `cycle_state.json`
- `cycle_trades.json`
- `positions.json`
- `trending_tokens_feb9.json`

## Troubleshooting

### "Route not found" (Jupiter API)

**Causes:**
- Trade size too small (< 0.01 SOL)
- Insufficient liquidity
- Token doesn't have pools on Jupiter-supported DEXs

**Fix:**
- Increase trade size
- Check token liquidity on DexScreener
- Try `sdkSwap.mjs` (uses Raydium SDK as fallback)

### RPC Rate Limiting (429 errors)

**Cause:** Too many rapid requests to Helius/Solana RPC

**Fix:**
- Space out wallet checks (add delays)
- Use a dedicated RPC endpoint
- Reduce polling frequency

### Transaction Failures

**Common causes:**
- Slippage too tight (increase to 200-300 bps for volatile tokens)
- Priority fee too low (increase in sdkSwap.mjs)
- Token pool liquidity dried up (check DexScreener)
- Blockhash expired (transaction took >60s to build)

### Jupiter API Down (404/DNS errors)

**Fallback:** Use `sdkSwap.mjs` which tries Raydium SDK first, Jupiter as backup.

## Development Notes

### Swap Execution Flow (sdkSwap.mjs)

```
1. Try Jupiter Ultra API quote + order
   ↓ (if fails)
2. Try Raydium SDK (CLMM/CPMM pools)
   ↓ (if fails)
3. Return error
```

### Priority Fees

Current setting: **0.0001 SOL (100,000 lamports)**

Higher fees = faster confirmation but more cost. Adjust in `sdkSwap.mjs`:

```javascript
priorityFeeLamports: 100000  // 0.0001 SOL
```

### Token Extensions (TOKEN_2022)

Newer Solana tokens may use the Token Extensions Program which adds features like:
- Transfer fees
- Confidential transfers
- Permanent delegation

Always check for TOKEN_2022 tokens in wallet scans to avoid missing positions.

## Contributing

Personal project. Use at your own risk. No warranty or support provided.

## License

MIT

## Disclaimer

**Trading cryptocurrencies carries significant risk.** This bot is experimental software. Only trade amounts you can afford to lose. Test thoroughly on devnet before mainnet. Not financial advice.
