# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-02-08

### 🚀 Major Changes

- **Migrated from Jupiter V6 to Ultra Swap API**
  - Old endpoint: `quote-api.jup.ag/v6/quote` (deprecated)
  - New endpoint: `api.jup.ag/ultra/v1/order`
  - Single API call returns both quote and ready-to-sign transaction
  - Versioned transactions only (V0), removed legacy Transaction support

### ✨ Features

- **Priority fee support**: Added `priorityFeeLamports` parameter (default: 1,000,000 lamports = 0.001 SOL)
- **Improved transaction reliability**: Enhanced `sendRawTransaction` with `maxRetries` and `preflightCommitment`
- **Better error handling**: Removed retryRpc wrapper from sendRawTransaction for clearer error messages
- **Wallet utilities**:
  - `checkWallet.mjs`: Display SOL and token balances
  - `testSwap.mjs`: Test Jupiter Ultra API swaps
  - `unwrapSol.mjs`: Convert wSOL to native SOL

### ⚙️ Configuration Changes

- **Minimum trade size increased**: `SIZE_SOL` 0.01 → 0.05 SOL (Ultra API requirement)
- **Jupiter API key now required**: Get from https://portal.jup.ag
- **Helius RPC recommended**: Add `HELIUS_RPC_URL` to `.env` for better reliability

### 🐛 Bug Fixes

- Fixed stablecoin filter in `degenCycle.mjs` (skip USDC/USDT/USD1/USDH)
- Fixed `liquidateAll.mjs` 100% sell functionality
- Fixed BigInt conversion errors for large token amounts
- Removed unsupported swap-instructions fallback (not needed with Ultra API)

### 📚 Documentation

- Added comprehensive README.md with setup and troubleshooting
- Updated .env.example with all required variables
- Added npm scripts: `npm run check`, `npm run test-swap`, `npm run liquidate`, `npm run unwrap`

### 🔧 Technical Improvements

- Simplified transaction flow (no separate quote + swap endpoints)
- Removed dead code paths for legacy Transaction deserialization
- All Jupiter swaps now use versioned transactions only
- Priority fees integrated at API level (not compute budget instructions)

### 🧪 Testing

- Tested successfully: 0.05 SOL → 7.19 RAY with 0.001 SOL priority fee
- Transaction confirmed in <30 seconds with priority fee
- [Example TX](https://solscan.io/tx/3z4dnXqz1rnNNfr8jkAxq9s6JtfapVXWrnXYZgxS73QHPH7AtTCqgBa9C5D75T6puDeRCpJhwKZN2reLexLmwS1u)

---

## [1.0.0] - 2026-02-03

### Initial Release

- Raydium SDK integration (CLMM, CPMM, AMM v4)
- Jupiter V6 API fallback
- Automated top volume tracking from DexScreener
- TP/SL exit strategy
- Web UI dashboard
