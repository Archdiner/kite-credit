# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Conventions

- **No `Co-Authored-By: Claude` lines in commit messages.** Never add them.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run test     # Jest (all tests)
npx jest path/to/test.ts  # Run a single test file
npx jest --testNamePattern "test name"  # Run a specific test by name
```

## Architecture Overview

Kite Credit is a portable credit scoring platform (Next.js App Router) that aggregates three data sources into a single 0–1000 Kite Score:

1. **On-chain (Solana)** — wallet age, DeFi interactions, staking, SOL/stablecoin balance
2. **Financial (Plaid + Reclaim Protocol ZK proofs)** — bank accounts and transactions
3. **Developer (GitHub OAuth)** — repo activity, commit history, code quality signals

The core insight is **dynamic signal weighting** — rather than averaging sources naively, `lib/scoring.ts` calculates a `signalStrength` (0–1) for each source and blends them so a strong source dominates a weak one (up to a 95/5 skew).

### Data Flow

```
User → Wallet connection (Phantom, mobile deep link) or GitHub OAuth
  → POST /api/score (rate-limited 5/min per IP, 5-min DB cache)
      ├─ lib/solana.ts  → on-chain data → OnChainScore (0–500)
      ├─ lib/plaid.ts / lib/reclaim.ts → FinancialScore (0–500)
      ├─ lib/github.ts → GitHubScore (0–300, bonus capped at +50 pts)
      └─ lib/scoring.ts → blend, 5-factor FICO model, ZK attestation
  → Saved to Supabase user_scores table
  → Shareable via POST /api/share → short /s/:id URL
```

### Key Directories

| Path | Purpose |
|---|---|
| `app/api/` | All API routes (auth, score, solana, github, plaid, reclaim, user, share) |
| `app/dashboard/` | Main user dashboard page |
| `app/s/[id]/` | Short share URL (OG metadata generation) |
| `lib/scoring.ts` | Core FICO-inspired scoring engine — 5-factor model + dynamic weights |
| `lib/solana.ts` | Solana RPC analysis (wallet age, txs, DeFi, staking, stablecoins) |
| `lib/github.ts` | GitHub API integration and scoring |
| `lib/auth.ts` | Session management + AES-256-GCM token encryption/decryption |
| `lib/attestation.ts` | ZK attestation generation and signing |
| `lib/rate-limit.ts` | In-memory rate limiting (Redis-compatible interface) |
| `components/dashboard/` | Score display, 5-factor breakdown, radar chart, attestation card |
| `components/providers/` | AuthProvider, WalletProvider (Solana adapter), Supabase context |
| `types/index.ts` | All shared TypeScript types (KiteScore, ZKAttestation, ShareData, etc.) |
| `supabase-schema.sql` | Full DB schema (reference for table structures) |

### Database (Supabase PostgreSQL)

- **`profiles`** — user display name/email, auto-created on signup via trigger
- **`user_connections`** — stores encrypted tokens and cached data for each provider (`solana_wallet`, `github`, `plaid`); unique per (user_id, provider); GitHub data cached in `metadata.github_data` for 24h
- **`user_scores`** — score history with full JSONB breakdown + AI explanation + ZK attestation
- **`shared_scores`** — short share URL storage; deduplicates by SHA256 hash of data

Sensitive tokens (Plaid, GitHub) are AES-256-GCM encrypted before DB storage using `DB_ENCRYPTION_KEY` (32-byte hex). The IV + ciphertext + auth tag are stored as hex.

### Scoring Model (lib/scoring.ts)

5-factor FICO-inspired breakdown:
1. Payment History (35%) — DeFi repayments + income consistency
2. Utilization (30%) — staking % + balance health
3. Credit Age (15%) — wallet age + account longevity
4. Credit Mix (10%) — protocol diversity + account diversity
5. New Credit (10%) — recent interactions + verification inquiries

Score assembly order: blend on-chain + financial via dynamic weights → apply 10% synergy boost (if both sources present) → apply trust dampener (if total strength <0.3) → add secondary wallet multiplier (2.5% per wallet, max 5%) → add GitHub bonus (up to +50) → cap at 1000.

Tiers: Elite (800–1000), Strong (700–799), Steady (600–699), Building (0–599).

### Mobile Wallet Handling

Desktop uses `@solana/wallet-adapter-react` (standard Phantom extension). Mobile uses Phantom deep links via `lib/phantom-deeplink.ts` — the flow redirects through `app/dashboard/phantom-callback/` to complete verification without in-app browser issues.

## Environment Variables

Required in `.env.local` (see `.env.example`):

```
SOLANA_RPC_URL             # QuickNode/Helius mainnet endpoint
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
GEMINI_API_KEY             # Google Gemini 2.0 Flash (AI explanations)
RECLAIM_APP_ID / RECLAIM_APP_SECRET
PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PRIVATE_KEY
ATTESTATION_SECRET         # 32-byte hex (openssl rand -hex 32)
DB_ENCRYPTION_KEY          # 32-byte hex (openssl rand -hex 32)
NEXT_PUBLIC_APP_URL        # http://localhost:3000 in dev
```
