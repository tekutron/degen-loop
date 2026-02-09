# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email the maintainer or open a private security advisory on GitHub.

## Security Incident - 2026-02-08

**Status**: ⚠️ **RESOLVED - ACTION REQUIRED**

### What Happened

A Helius RPC API key was accidentally committed to the repository in `checkWallet.mjs` (commit `07952bf`).

**Exposed Key**: `02246b9a-a724-4896-a95d-fbb2cd72ddad`

### Remediation

✅ **Fixed in commit `99513ac`**:
- Removed hardcoded API key from `checkWallet.mjs`
- Updated `.gitignore` to prevent future leaks
- Removed runtime state files from tracking

### Required Actions

🔴 **IMMEDIATE**: Rotate the following API keys:

1. **Helius RPC API Key** - Get a new key from https://helius.dev
2. **Jupiter API Key** (if committed elsewhere) - Rotate at https://portal.jup.ag
3. **0x API Key** (if committed) - Rotate at https://0x.org

### Update Your `.env`

After rotating keys, update your local `.env` file:

```bash
# Replace with NEW keys
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=NEW_KEY_HERE
JUPITER_API_KEY=NEW_KEY_HERE
ZEROX_API_KEY=NEW_KEY_HERE
```

### Prevention

To prevent future incidents:

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Never hardcode API keys** - Use `process.env.*` everywhere
3. **Check before committing**: `git diff --cached` to review changes
4. **Use git hooks**: Consider pre-commit hooks to scan for secrets
5. **Review `.gitignore`**: Ensure all sensitive files are listed

### Git History

⚠️ The exposed key still exists in git history. Options:

1. **Recommended**: Rotate the key (simpler, immediate)
2. **Advanced**: Use BFG Repo-Cleaner to purge history (complex, requires force-push)

For most users, **rotating the key is sufficient**.

## Best Practices

### Environment Variables

Always use environment variables for sensitive data:

```javascript
// ❌ BAD
const apiKey = '02246b9a-a724-4896-a95d-fbb2cd72ddad';

// ✅ GOOD
const apiKey = process.env.HELIUS_API_KEY;

// ✅ BETTER (with fallback to safe default)
const rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
```

### Wallet Security

- **Never commit wallet private keys** (`wallets/` is in `.gitignore`)
- Store wallets outside the repo for production
- Use hardware wallets for large amounts
- Rotate wallets if compromised

### API Key Rotation Schedule

- **After any exposure**: Immediately
- **Regular rotation**: Every 90 days
- **Before open-sourcing**: Always rotate all keys

## Current .gitignore Coverage

Protected files:

```
.env, .env.local, .env.*.local
wallets/
cycle_state.json (contains RPC URLs)
positions.json
trade_proposals.json
*.log files
```

## Questions?

Open an issue if you have security concerns or questions about this incident.

---

**Last Updated**: 2026-02-08  
**Status**: ✅ Vulnerability patched, key rotation required
