# Token List Update - Feb 9, 2026

## Strategy: 60% Tier 2 (Strong Activity) / 40% High Risk High Reward

Total tokens: **15**

Updated: `2026-02-10T00:39:20.080Z`

Label: **"Hot Trending Memes (60% Stable/40% High Risk)"**

---

## Tier 2: Strong Activity + Good Liquidity (60% - 9 tokens)

### 1. GROYPER
- **Volume 24h**: $2.5M
- **Liquidity**: $78K
- **Price**: $0.00066
- **Movement**: +2,265%
- **Mint**: `5c7cerjkb2nw2pibtsbmd9zto5jgmvypncwbmtmxvqzh`

### 2. Company
- **Volume 24h**: $1.4M
- **Liquidity**: $80K
- **Price**: $0.01070
- **Movement**: +2,040%
- **Mint**: `4jfhe93lg7jdbqs2834dd7fcq5kqcjrhwwvbv7zeo5dt`

### 3. LOTUS (Lion Of The United States)
- **Volume 24h**: $4.1M
- **Liquidity**: $131K
- **Price**: $0.002605
- **Movement**: +4,857%
- **Mint**: `42ob5prnn8bprm3g3r6wqgp98bnlhug38x2pysyznst2`

### 4. LIQUID (Meme Liquid)
- **Volume 24h**: $2.0M
- **Liquidity**: $107K
- **Price**: $0.001197
- **Mint**: `hv7kcomcekmk4aqdtrhq2xwdemclabgsr99rwimdgcha`

### 5. BurgerKing (The Burger King)
- **Volume 24h**: $676K
- **Liquidity**: $113K
- **Price**: $0.002050
- **1h Movement**: +3,811%
- **Mint**: `hs1v7kgvyczdxz7zchkxwe1b8oy1hjezu5n6qect8u6p`

### 6. DRESS (Bad Bunny with dress)
- **Volume 24h**: $379K
- **Liquidity**: $127K
- **Price**: $0.002641
- **24h**: +28.46%
- **Movement**: +4,934%
- **Mint**: `6qy1ede4nr6cupkk8ypvekhrtwbjxxgdenn58arrk5qv`

### 7. PENGUIN (Nietzschean Penguin)
- **Volume 24h**: $2.4M
- **Liquidity**: $764K (Most stable)
- **Price**: $0.02282
- **Market Cap**: $22.8M
- **Mint**: `draf8qxqy86h7yehdo9gytxaf6gottt8ozjknwxv6dcs`

### 8. Buttcoin
- **Volume 24h**: $3.6M
- **Liquidity**: $823K (Highest)
- **Price**: $0.03166
- **Market Cap**: $31.6M
- **Mint**: `ffcygssgwhfora9rxxka48p8yfoz8tsw85jpo3cqhdys`

### 9. Pigeon (level941)
- **Volume 24h**: $1.0M
- **Liquidity**: $119K
- **Price**: $0.001184
- **Mint**: `fxrvcgmqfgj3wrmuxgh8qhvlau3q4t7jqekboqhvecr7`

---

## Tier 1: High Risk / High Reward (40% - 6 tokens)

### 10. Goyim
- **Volume 24h**: $2.9M
- **Liquidity**: $240K
- **Price**: $0.003461
- **1h**: +7.97% | **24h**: +23.37%
- **Movement**: +147%
- **Mint**: `ascsdmpkbxdnriprkgapilu4kukc6p8vgnbtnhgw3hnf`

### 11. しずく (Shizuku AI)
- **Volume 24h**: $2.0M
- **Liquidity**: $50K ⚠️
- **Price**: $0.0003387
- **3h**: +89.29% | **24h**: +291%
- **Movement**: +841% 🔥
- **Mint**: `36neatprzux7crpma5wwx4qwhzberghgf8atbn1xhayx`

### 12. Ferociter (Gradatim Ferociter)
- **Volume 24h**: $5.2M (Highest)
- **Liquidity**: $42K ⚠️
- **Price**: $0.0002098
- **10h**: +8.15%
- **Movement**: +496%
- **Mint**: `9y3wyw7jidoj3j5xvs12xwgvbb8idxand1efhyvezj4n`

### 13. Dchan (Discord-chan)
- **Volume 24h**: $1.4M
- **Liquidity**: $175K
- **Price**: $0.004869
- **3h**: +2.92% | **24h**: +21.85%
- **Movement**: +9,153% 🚀
- **Market Cap**: $4.8M
- **Mint**: `9un3rg9nhxrdil7ekuek8fuysrgzzmm4kblkdv7mmmty`

### 14. BOBO
- **Volume 24h**: $249K
- **Liquidity**: $42K ⚠️
- **Price**: $0.0002887
- **24h**: +16.93%
- **Movement**: +666%
- **Mint**: `dsrw6dxhyav6u6vmz74jmq4ttjdsw7uepbbuheiokfqh`

### 15. minicaseoh
- **Volume 24h**: $222K
- **Liquidity**: $25K ⚠️ (Lowest - highest risk)
- **Price**: $0.0001061
- **1h**: +88.63% | **24h**: +241%
- **Movement**: +195%
- **Mint**: `3jhe9rqgizxyqgwancqcbav8yf6squbv9qezhfftvuta`

---

## Risk Assessment

### ⚠️ High Risk Tokens (Low Liquidity <$50K)
- Shizuku AI: $50K liquidity
- Ferociter: $42K liquidity
- BOBO: $42K liquidity
- minicaseoh: $25K liquidity (EXTREME RISK)

### ✅ Lower Risk Tokens (Good Liquidity >$100K)
- Buttcoin: $823K liquidity
- PENGUIN: $764K liquidity
- Goyim: $240K liquidity
- Dchan: $175K liquidity
- LOTUS: $131K liquidity
- DRESS: $127K liquidity
- Pigeon: $119K liquidity
- LIQUID: $107K liquidity

---

## Data Source

- **DexScreener**: Real-time Solana trending (Feb 9, 2026 - 16:29 PST)
- **Refresh**: Web app reads from `cycle_state.json` which updates every 10 minutes
- **Bot**: Will trade these tokens in sequence when running

---

## How It Works

1. **Web App**: Reads `cycle_state.json` via `/api/trending/solana/route.ts`
2. **Bot**: Updates `trending` array every 10 minutes from DexScreener
3. **Trading**: Bot cycles through list, attempting to buy/sell with TP/SL

---

## Notes

- All tokens are Solana-based meme coins or ecosystem plays
- Priority given to high 24h volume and recent price momentum
- Avoided ultra-low liquidity rugs (<$25K)
- List will auto-refresh when bot runs (every 10 min)
- Web app refreshes on page reload

**⚠️ WARNING**: These are highly volatile meme coins. Trade with caution and only risk what you can afford to lose.
