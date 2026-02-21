# Kite Credit — Project Notes
**Last updated: Feb 21, 2026**

---

## Why This Exists

Traditional credit scoring is broken in three specific ways. First, it's geographically captured — a billion people in emerging markets have real financial behavior and zero credit history because they never interfaced with a Western bank. Second, it's opaque — your FICO score is a black box produced by three private companies using criteria you can't inspect or contest. Third, it excludes entire categories of legitimate financial actors — DeFi natives who hold and deploy significant capital on-chain, developers whose GitHub track record is a more honest signal of financial reliability than their bank balance, freelancers paid in crypto with no W-2 to show a landlord.

Kite is the answer to that. A portable, verifiable, data-source-agnostic credit score that aggregates what you actually do — on-chain, on GitHub, at your bank — into a single number you own and can prove without handing over your raw data. The insight that makes it work is dynamic signal weighting: rather than naively averaging sources, the model reads signal strength and lets the strongest source dominate. A Solana DeFi power user with no bank account gets scored on their actual behavior, not penalized for the absence of a Chase account.

---

## How It Works — End to End

### Data Sources

**1. Solana (on-chain)**
The primary signal. Kite connects to mainnet via RPC (QuickNode/Helius) and reads the wallet's entire history — paginated across up to 10,000 transactions. It extracts:
- Wallet age (days since first transaction)
- Transaction volume and recency
- DeFi protocol interactions — 11 protocols tracked: Kamino, marginfi, Solend (lending), Jupiter, Raydium, Orca, Meteora, Phoenix (DEX), Drift (perps), Tensor (NFT), Marinade and Jito (staking)
- Native SOL staking status and duration
- Liquid staking token holdings (jitoSOL, mSOL, bSOL)
- Stablecoin reserves (USDC + USDT)
- Liquidation events (heuristic: sharp SOL balance drop in a complex lending transaction)
- DAO participation (SPL Governance, Realms v2)

**2. GitHub (developer reputation)**
OAuth-connected. Uses approximately 8-10 API calls per score with a 24-hour cache to stay within rate limits. Reads: account age, repository portfolio (volume, originality, longevity, language diversity), commit frequency, active weeks, star reputation, followers, PR and code review activity, presence of CI/CD configs and test frameworks. Scores 0–300.

**3. Financial (Plaid + Reclaim Protocol)**
Plaid connects real bank accounts — balance and 30 days of transactions. The balance bracket ($0–1k, 1k–5k, 5k–25k, 25k–100k, 100k+) and income consistency (>5 transactions in 30 days) feed the financial score. Reclaim Protocol provides ZK proof verification for privacy-preserving bank data (currently scaffolded — structure valid, cryptographic verification is the remaining build item).

### Scoring Model

Five-factor FICO-inspired model, assembled in `lib/scoring.ts`:

| Factor | Weight | Signals |
|---|---|---|
| Payment History | 35% | DeFi repayments, bank bill pay consistency |
| Utilization | 30% | Staking percentage, balance health |
| Credit Age | 15% | Wallet age, bank account longevity |
| Credit Mix | 10% | Protocol diversity (categories matter), account diversity |
| New Credit | 10% | Recent DeFi interactions, verification inquiries |

**Dynamic signal weighting** is the core IP. Each source gets a `signalStrength` (0–1) based on data depth. If one source scores above 0.8 and another below 0.2, the model skews to a 95/5 blend. This prevents a fresh wallet from being unfairly penalized against a strong GitHub signal, and vice versa.

**Score assembly order:**
1. Blend on-chain + financial via dynamic weights
2. Apply 10% synergy boost if both sources are present and strong
3. Apply trust dampener (0.5x–1.0x multiplier) if total signal strength is below 0.3 — prevents bot farming
4. Add secondary wallet bonus (2.5% per verified secondary wallet, max 5%)
5. Add GitHub bonus (0–50 pts, capped at score/6)
6. Hard cap at 1000

**Tiers:** Building (0–599) · Steady (600–699) · Strong (700–799) · Elite (800–1000)

### Authentication

Supabase email/password auth with full email verification flow. GitHub OAuth for developer scoring. Wallet connection via:
- Desktop: `@solana/wallet-adapter-react` (Phantom, Solflare, Coinbase)
- Mobile: Phantom deep links through `/dashboard/phantom-callback/` — avoids in-app browser issues

Wallet ownership is proven via `signMessage()` — the user signs a human-readable message (`Kite Credit: verify ownership of <address> | nonce: <uuid>`). No transactions are ever requested. No private keys are ever touched.

### Attestation & Sharing

Every computed score generates a `SignedAttestation` — an HMAC-SHA256 signature over `{total, tier, sources, timestamp}` using a server-side secret. This is the portable credential.

Users share via `/s/:id` — a 6-character base64url ID backed by a Supabase row. The share page functions as a full verification portal:
- Server-side HMAC check on load → clear VALID / INVALID badge
- Score, tier, verified attributes (Solana, GitHub, Bank) with icons
- Score freshness display
- Machine-readable verification: `GET /api/verify/:id` returns CORS-enabled JSON `{ valid, score, tier, verified_attributes, issued_at, age_hours }`

This last endpoint is the B2B primitive — a DeFi protocol or lender verifies a score with a single fetch call, no SDK, no sales cycle, no user involvement after the initial share.

---

## Current State

### Fully working, production-ready
- Supabase auth: signup, signin, email verification, forgot password, reset password
- Solana on-chain scoring: complete RPC analysis pipeline
- GitHub scoring: API-efficient fetch with 24h cache, full 5-signal model
- Score assembly: 5-factor FICO model with dynamic weighting
- Dashboard: wallet connection (desktop + mobile), GitHub OAuth, score display, 5-factor breakdown, radar chart, attestation card, share card
- Share system: short URLs, OG metadata, social preview images
- Public verification page + `/api/verify/:id` API
- Token encryption: AES-256-GCM for stored GitHub and Plaid tokens
- Rate limiting: Supabase-backed fixed window (5 req/min for scoring)
- AI explanation: Gemini 2.0 Flash with graceful fallback

### Partially built
- **Plaid**: Connection works, tokens stored encrypted, basic balance/transaction scoring works — running in sandbox mode. Needs production Plaid credentials and approval to use real bank accounts.
- **Reclaim Protocol**: Full flow scaffolded (initiate verification, callback handler, proof processing, financial scoring). The `verifyProof()` function does structure validation only — actual signature verification against Reclaim's attestor nodes is the remaining piece. Until this is done, the "bank verified" attribute on an attestation via Reclaim is not cryptographically backed.

### Known gaps
- No lender/third-party portal beyond the `/s/:id` verification page
- Score refresh is manual — no scheduled re-scoring or staleness notifications
- Statement upload parser (`lib/statement-parser.ts`) is built but not wired to an API route
- Distributed rate limiting not needed at current scale but in-memory won't work across multiple server instances
- Mobile: Phantom deep link flow works but is the most fragile part of the system

---

## Key Technical Decisions Worth Knowing

**Why HMAC-SHA256 and not actual ZK proofs for the attestation?**
True ZK proofs (like Reclaim's) require the underlying data to be generated inside a ZK circuit. Kite's attestation covers the final score, not the underlying data — so HMAC signing against a server secret is the correct primitive. "ZK Attestation" is product language. The actual ZK lives in Reclaim (bank data is never revealed, only proven).

**Why dynamic weighting instead of fixed percentages?**
Fixed weights punish users for missing sources. Someone with a 3-year Solana wallet and zero bank account is not a credit risk — they're an on-chain native. The dynamic model reads what you have and weights it appropriately, rather than docking 50% for not having a Chase account.

**Why Supabase instead of a custom backend?**
Speed. RLS handles per-user data isolation, the auth triggers auto-create profiles, and the `user_connections` / `user_scores` / `shared_scores` schema covers all data needs. The database is the session store, the cache, and the attestation log simultaneously.

**Security posture:**
The site cannot drain wallets. The only wallet interaction is `signMessage()` with a human-readable string. No `sendTransaction`, no token approvals, no private key handling anywhere in the codebase. All Solana RPC calls are read-only. Verified via full security audit Feb 21, 2026.

---

## Immediate Next Steps

**1. Reclaim cryptographic verification (1–2 days)**
The biggest credibility gap. `lib/reclaim.ts:verifyProof()` needs to call `Reclaim.verifySignedProof(proof)` from the `@reclaimprotocol/js-sdk`. Once this is done the "bank verified" attribute on an attestation is actually trustworthy, not just structurally valid.

**2. Plaid production credentials (admin task, not code)**
Apply for Plaid development/production access. Swap `PLAID_ENV=sandbox` to `development`. The code is already correct — this is purely a credentials and approval process with Plaid.

**3. Score freshness + re-score prompt**
The `user_scores` table logs every computation with a timestamp. Surface this in the dashboard: "Score last computed 14 days ago — refresh?" with a one-click re-score. Keeps scores from going stale silently.

**4. Agent mode / agent-optimized scoring**
AI agents holding Solana wallets is happening now (Virtuals, ELIZA framework, etc.). They have real on-chain history, potentially GitHub repos, and zero ability to open a bank account. Kite's model handles this naturally but needs a small adjustment: explicitly suppress the trust dampener penalty for wallets with strong on-chain signals and no bank connection. A flag in the score request (`agentMode: true`) would be enough. The `/api/verify/:id` endpoint is already the native agent integration point.

---

## Longer Term Vision

### The demand side (6–12 months)

The score exists. The verification API exists. The missing piece is the demand side — entities that consume Kite scores. The path:

**DeFi protocol integrations**: Kamino, marginfi, and similar lending protocols could use a Kite Score to offer undercollateralized positions to Elite-tier wallets. The integration is a single endpoint call. The pitch: instead of requiring 150% collateral from everyone, offer 110% collateral to wallets that have proven 2+ years of clean lending history.

**DAO governance**: Treasury voting weighted by Kite Score tier. Prevents Sybil attacks without requiring KYC. A Strong-tier wallet has proven skin in the game.

**Real world**: Landlords and lenders for the crypto-native population who can't show a W-2. The share link + verification page is already the right interface. This is a massive underserved market.

### On-chain attestation (12+ months)

Moving the HMAC proof to a Solana program. Instead of trusting Kite's server to verify an attestation, the proof lives on-chain and any program can read it permissionlessly. This is the endgame — a Kite Score becomes a composable primitive that smart contracts can reference natively, the way they reference token balances.

The path there: a Solana program that stores `{wallet, score_hash, tier, timestamp, expiry}`, updatable by the Kite authority keypair. Protocols can then write `require(kite_score.tier >= "Strong")` directly in their contract logic.

### Cross-chain (12+ months)

The scoring model is chain-agnostic. EVM wallets (Ethereum, Base, Arbitrum) have the same on-chain signals — wallet age, DeFi protocol interactions, staking, stablecoin reserves. The Solana RPC layer in `lib/solana.ts` is the only chain-specific code. An `lib/evm.ts` equivalent using `viem` covers the EVM universe.

### Agent economy credit infrastructure (emerging)

The most forward-looking angle. Autonomous AI agents managing real capital need trust infrastructure between themselves and with protocols. They can hold wallets, build on-chain history, deploy code to GitHub repos — but cannot open bank accounts or have FICO scores. Kite is the only scoring system built on exactly the signals agents can generate. The `/api/verify/:id` endpoint is already the agent-native interface: no UI, pure JSON, CORS-enabled. The near-term build is making scores refreshable on a schedule (agents need current creditworthiness, not a 6-month-old score) and adding webhook support so a protocol can subscribe to score changes for a given wallet.

---

## The One-Line Version

Kite Credit is a portable credit score for anyone whose financial life lives on-chain, on GitHub, or both — with a signed proof they can share anywhere and a verification API that makes the score useful without requiring trust in the score holder.
