// ---------------------------------------------------------------------------
// Main Scoring API Route
// ---------------------------------------------------------------------------
// Calculates the user's Kite Score based on:
// 1. Wallet signature verification (auth)
// 2. On-chain data analysis (50%)
// 3. Financial data analysis via Plaid (50%)
// 4. GitHub data analysis (bonus)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyWalletSignature } from "@/lib/wallet-verify";
import { analyzeSolanaData, scoreOnChain } from "@/lib/solana";
import { fetchGitHubData, scoreGitHub } from "@/lib/github";
import { plaidClient, type PlaidFinancialData } from "@/lib/plaid";
import { scoreFinancial } from "@/lib/reclaim"; // reused for now, will refactor
import { assembleKiteScore } from "@/lib/scoring";
import { generateAttestation } from "@/lib/attestation";
import { GoogleGenerativeAI } from "@google/generative-ai";

// genAI instantiation moved inside handler to prevent startup crashes

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Plaid token should be in HTTP-only cookie, not body
        const cookieStore = await cookies();
        const plaidAccessToken = cookieStore.get("plaid_access_token")?.value;

        const { walletAddress, walletSignature, includeGithub } = body;

        // 1. Verify Wallet Ownership
        // Strict verification: Fail if signature is missing or invalid
        // Expect format: "nonce:signatureBase64"

        let nonce = "";
        let signature = "";

        if (walletSignature && walletSignature.includes(":")) {
            const parts = walletSignature.split(":");
            nonce = parts[0].trim();
            signature = parts[1].trim();
        } else {
            // If legacy format or missing nonce, this will fail strict verification
            signature = walletSignature;
        }

        if (!walletSignature || !verifyWalletSignature(walletAddress, nonce, signature)) {
            return NextResponse.json({ success: false, error: "Invalid or missing wallet signature" }, { status: 401 });
        }

        // 2. Fetch & Score On-Chain Data
        const onChainData = await analyzeSolanaData(walletAddress);
        const onChainScore = scoreOnChain(onChainData);

        // 3. Fetch & Score Financial Data (Plaid)
        let financialScore = null;
        let financialContext = "No financial data connected.";

        if (plaidAccessToken) {
            try {
                // Fetch real Plaid data
                const accountsRes = await plaidClient.accountsGet({ access_token: plaidAccessToken });
                const now = new Date();
                const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
                const txRes = await plaidClient.transactionsGet({
                    access_token: plaidAccessToken,
                    start_date: start.toISOString().split("T")[0],
                    end_date: now.toISOString().split("T")[0],
                });

                const accounts = accountsRes.data.accounts;

                // Calculate financial metrics from Plaid data (Fix: access balances object safely)
                const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balances.available ?? acc.balances.current ?? 0), 0);

                // Determine balance bracket
                let balanceBracket = "under-1k";
                if (totalBalance >= 100000) balanceBracket = "100k+";
                else if (totalBalance >= 25000) balanceBracket = "25k-100k";
                else if (totalBalance >= 5000) balanceBracket = "5k-25k";
                else if (totalBalance >= 1000) balanceBracket = "1k-5k";

                // Determine income consistency (mock logic based on tx count for now)
                const incomeConsistency = txRes.data.transactions.length > 5;

                financialScore = scoreFinancial({
                    verified: true,
                    proofHash: "plaid_verified_" + Math.random().toString(36).substring(7),
                    balanceBracket,
                    incomeConsistency,
                    provider: "plaid"
                });

                financialContext = `Bank connected via Plaid. Total balance: $${totalBalance.toFixed(2)}. Transactions: ${txRes.data.transactions.length}.`;
            } catch (error) {
                console.error("Plaid fetch failed:", error);
            }
        }

        // 4. GitHub Bonus (Optional)
        let githubScore = null;
        if (includeGithub) {
            // In real app, fetch token from DB. For prototype, we simulate analysis
            // or fetch public data if username provided. 
            // Assuming existing logic holds for now.
            githubScore = { score: 0, breakdown: { accountAge: 0, repoPortfolio: 0, commitConsistency: 0, communityTrust: 0 } };
            // Placeholder for actual GitHub fetching logic from Phase 3
        }

        // 5. AI Explanation
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ success: false, error: "AI service unavailable" }, { status: 503 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // genAI moved inside POST handler to prevent startup crashes if env var missing
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
      Analyze this credit profile for a DeFi lending protocol.
      Wallet: ${walletAddress} (Age: ${onChainData.walletAgeDays} days, DeFi interactions: ${onChainData.deFiInteractions.length})
      Financial: ${financialContext}
      Provide a 2-sentence explanation of their creditworthiness.
    `;
        const aiResult = await model.generateContent(prompt);
        const explanation = aiResult.response.text();

        // 6. Assemble Final Score
        const kiteScore = assembleKiteScore({
            onChain: onChainScore,
            financial: financialScore,
            github: githubScore,
        }, explanation);

        // 7. Generate ZK Attestation
        const attestation = generateAttestation(kiteScore);

        return NextResponse.json({
            success: true,
            data: {
                score: kiteScore,
                attestation: attestation
            }
        });

    } catch (error) {
        console.error("Scoring error:", error);
        return NextResponse.json({ success: false, error: "Calculation failed" }, { status: 500 });
    }
}
