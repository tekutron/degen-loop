# degen-loop

Solana degen trading UI (Next.js) with Raydium execution, Phantom wallet, proposal/positions integration, and optional price display via free Jupiter API.

## Features

- App Router (Next 14)
- Phantom connect (Wallet Adapter)
- Proposals
  - Source from file or URL (env)
  - Live Raydium compute quotes
  - Simulate on-chain before send (optional)
  - YES executes swap (wrap SOL + ATAs handled)
  - Input/Output USD prices (Jupiter Price API)
- Positions
  - Reads your jupbot positions.json
  - Sell NOW → Raydium swap to wSOL
- Settings (client-side overrides)
  - RPC override (localStorage)
  - Cluster override (mainnet/devnet)
  - Default slippage bps (stored locally)

## Quick start

1) Requirements
- Node 18+
- Phantom in the browser (for signing)
- A Solana RPC (public mainnet is okay to start)

2) Clone & install
```bash
# clone your repo as usual, then:
cd apps/web
npm install
```

3) Environment
Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
# proposals source (pick one)
# PROPOSALS_URL=https://your.host/trade_proposals.json
PROPOSALS_PATH=/home/j/.openclaw/workspace/jupbot/trade_proposals.json
# positions source (optional override; default shown below)
# POSITIONS_PATH=/home/j/.openclaw/workspace/jupbot/positions.json
```

4) Dev
```bash
cd apps/web
npm run dev
# open http://localhost:3000
```

## Pages

- `/proposals`
  - Loads proposals from `/api/proposals` (URL or PATH or fallback file)
  - Shows live quotes (Raydium compute), USD prices (Jupiter), Simulate & YES buttons
- `/positions`
  - Loads positions from `/api/positions` (PATH or default)
  - Shows token amount (formatted), Sell NOW → wSOL
- `/settings`
  - RPC/Cluster/Slippage overrides via localStorage

## API Routes

- `GET /api/proposals`
  - Returns proposals from PROPOSALS_URL (HTTP) or PROPOSALS_PATH (file) or apps/web/proposals.json
- `POST /api/proposals/refresh`
  - Generates proposals from apps/web/pairs.json and writes to PROPOSALS_PATH (or fallback)
- `GET /api/positions`
  - Returns positions from POSITIONS_PATH (or default `/home/j/.openclaw/workspace/jupbot/positions.json`)
- `POST /api/tx/simulate`
  - Body: `{ txBase64, version: 'V0'|'LEGACY' }`
  - Simulates the transaction using NEXT_PUBLIC_SOLANA_RPC
- `GET /api/price/jupiter?mint=<MINT>`
  - Free price lookup via Jupiter Price API v6

## Proposals JSON shape

We expect either `[{...}, ...]` or `{ "proposals": [{...}] }`.
Each proposal should include:
```json
{
  "id": "unique-string",
  "status": "PROPOSED",
  "pair": "wSOL/USDC",
  "inputMint": "So111...",
  "outputMint": "EPjF...",
  "slippageBps": 50,
  "amountRaw": 1000000,
  "txVersion": "V0"
}
```

## Positions JSON shape

We accept either `[{...}, ...]` or `{ "positions": [{...}] }`.
Minimal fields:
```json
{
  "id": "optional-id",
  "mint": "So111...",
  "symbol": "optional",
  "amountRaw": "123456789",
  "tokenDecimals": 9
}
```
Additional fields are rendered as-is (won't break UI).

## Tokens metadata

- apps/web/tokens.json contains common mints, symbols, decimals
- UI uses it to format amounts (proposals & positions)
- Extend this file to add more tokens

## Safety & notes

- Simulate before send (button available on /proposals)
- YES uses Raydium tx builder with wrap SOL + ATAs
- Always verify the pair and amount before signing
- Settings overrides are local only (no secrets in repo)

## Deploy (Vercel or similar)

- Build: Next.js App Router
- Environment variables (Project Settings):
  - `NEXT_PUBLIC_SOLANA_RPC` (required)
  - `PROPOSALS_URL` or `PROPOSALS_PATH` (pick your source; for serverless, prefer URL)
  - `POSITIONS_PATH` (optional; prefer URL if serverless)

## Troubleshooting

- Git push errors with large files → ensure `.gitignore` ignores `node_modules/` and `.next/`
- RPC not set → NEXT_PUBLIC_SOLANA_RPC must be in `.env.local` (dev) or project env (prod)
- 500 on /proposals → source missing/invalid; verify PROPOSALS_PATH or PROPOSALS_URL
- Phantom not connecting → ensure browser Phantom extension is installed and unlocked

---

PRs welcome. Add pairs in `apps/web/pairs.json` for generator; extend `tokens.json` as needed.
