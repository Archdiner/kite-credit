# Kite Credit

A persistent, cross-border credit score that follows you wherever you go.

## The Problem

Moving across borders erases your financial identity. Years of responsible borrowing, consistent income, and professional reputation vanish the moment you step into a new country. Billions of people are locked out of housing, lending, and basic financial services because their history doesn't travel with them.

## What Kite Credit Does

Kite Credit builds a portable credit score by pulling from three distinct sources of reputation:

**On-chain activity.** Your behavior on Solana -- interactions with lending protocols like Kamino and Solend, DAO participation, staking history, and repayment patterns. This accounts for 40% of your score.

**Professional history.** Your GitHub profile -- commit frequency, how long you've maintained repositories, contribution patterns, and consistency of work over time. This accounts for 30% of your score.

**Traditional cash flow.** Your bank balances and income consistency, verified through zero-knowledge proofs so that Kite Credit never sees your raw banking credentials or transaction history. This accounts for the remaining 30%.

These three inputs are weighted and combined into a single Kite Score on a 0-1000 scale.

## How Scoring Works

The score uses a straightforward weighted average:

| Source | Weight | What It Measures |
|---|---|---|
| On-Chain Health | 40% | Wallet age, DeFi repayment history, staking behavior |
| Professional Trust | 30% | GitHub activity, contribution consistency, repo longevity |
| Financial Stability | 30% | Verified cash flow via zero-knowledge proofs of bank data |

The weighting reflects the conviction that on-chain behavior is the most tamper-resistant signal available, while professional and financial data round out the picture with real-world context.

## Privacy Model

Kite Credit does not store raw bank transactions, private repository data, or login credentials. The system works on a zero-knowledge-first basis:

- Bank data is verified through the Reclaim Protocol, which generates HTTPS-based ZK-proofs. The user proves facts about their finances (like "my average balance exceeds X") without revealing the underlying numbers.
- GitHub and Solana data are pulled through user-initiated OAuth flows. The user controls what gets scanned and when.
- The only things stored are the resulting proof and the score itself.

The output is a ZK-Attestation -- a signed JSON object containing the Kite Score, a list of verified attributes (e.g., "github_linked", "solana_active"), and the cryptographic proof. This attestation can be shared with a landlord, a lender, or anyone else who needs to verify creditworthiness, without exposing the raw data behind it.

## The Dashboard

The interface includes a plain-language explanation of your score. Rather than presenting a number with no context, it tells you what moved your score and what you could do to improve it. For example: "Your score rose 15 points because you contributed to 4 open-source repos this week."

The design follows a warm, minimal aesthetic -- more institutional finance than crypto. The intent is to feel like a product you would trust with something as important as your credit history.

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React 19, Tailwind CSS v4 |
| Animations | Framer Motion, Lenis (smooth scroll) |
| Blockchain | Solana (mainnet-beta for data reads) |
| ZK Infrastructure | Reclaim Protocol |
| Score Explanation | Gemini 2.0 Flash |
| Storage | In-memory for MVP (Firebase planned for persistence) |

## Running Locally

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Project Status

This is an MVP prototype. The current build includes the landing page and visual identity. The scoring engine, wallet connection flow, GitHub integration, ZK-proof generation, and dashboard are under active development.

## What Comes Next

- Direct credit-line issuance through Kamino, based on Kite Score
- Native mobile app for proving credit at physical borders
- Decentralized vouching through a community DAO for credit boosting

## License

Private. All rights reserved.
