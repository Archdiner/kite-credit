// ---------------------------------------------------------------------------
// Main Scoring API Route
// ---------------------------------------------------------------------------
// Calculates the user's Kite Score based on:
// 1. Wallet signature verification (auth)
// 2. On-chain data analysis (50%)
// 3. Financial data analysis via Plaid (50%)
// 4. GitHub data analysis (bonus)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyWalletSignature } from "@/lib/wallet-verify";
import { analyzeSolanaData, scoreOnChain } from "@/lib/solana";
import { fetchGitHubData, scoreGitHub } from "@/lib/github";
import { plaidClient } from "@/lib/plaid";
import { scoreFinancial } from "@/lib/reclaim";
import { assembleKiteScore } from "@/lib/scoring";
import { generateAttestation } from "@/lib/attestation";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const cookieStore = await cookies();
        const plaidAccessToken = cookieStore.get("plaid_access_token")?.value;

        const { walletAddress, walletSignature, includeGithub } = body;

        // 1. Verify Wallet Ownership
        let nonce = "";
        let signature = "";

        if (walletSignature && walletSignature.includes(":")) {
            const parts = walletSignature.split(":");
            nonce = parts[0].trim();
            signature = parts[1].trim();
        } else {
            signature = walletSignature;
        }

        // Validate walletAddress is present and well-formed (base58, 32-44 chars)
        if (!walletAddress || typeof walletAddress !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
            return errorResponse("Missing or invalid wallet address", 400);
        }

        if (!walletSignature || !verifyWalletSignature(walletAddress, nonce, signature)) {
            return errorResponse("Invalid or missing wallet signature", 401);
        }

        // 2. Fetch & Score On-Chain Data
        const onChainData = await analyzeSolanaData(walletAddress);
        const onChainScore = scoreOnChain(onChainData);

        // 3. Fetch & Score Financial Data (Plaid)
        let financialScore = null;
        let financialContext = "No financial data connected.";

        if (plaidAccessToken) {
            try {
                const accountsRes = await plaidClient.accountsGet({ access_token: plaidAccessToken });
                const now = new Date();
                const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const txRes = await plaidClient.transactionsGet({
                    access_token: plaidAccessToken,
                    start_date: start.toISOString().split("T")[0],
                    end_date: now.toISOString().split("T")[0],
                });

                const accounts = accountsRes.data.accounts;
                const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balances.available ?? acc.balances.current ?? 0), 0);

                let balanceBracket = "under-1k";
                if (totalBalance >= 100000) balanceBracket = "100k+";
                else if (totalBalance >= 25000) balanceBracket = "25k-100k";
                else if (totalBalance >= 5000) balanceBracket = "5k-25k";
                else if (totalBalance >= 1000) balanceBracket = "1k-5k";

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
                console.error("[score] Plaid fetch failed:", error);
            }
        }

        // 4. GitHub Bonus (Optional)
        let githubScore = null;
        if (includeGithub) {
            const githubToken = cookieStore.get("github_token")?.value;
            if (githubToken) {
                try {
                    const githubData = await fetchGitHubData(githubToken);
                    githubScore = scoreGitHub(githubData);
                } catch (error) {
                    console.error("[score] GitHub fetch failed:", error);
                    // Non-fatal: score continues without GitHub bonus
                }
            }
        }

        // 5. AI Explanation (graceful fallback if Gemini unavailable)
        let explanation = "Your Kite Score is based on on-chain activity, financial health, and developer reputation.";

        if (process.env.GEMINI_API_KEY) {
            try {
                // Dynamic import to avoid startup crashes if package is missing
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `Analyze this credit profile for a DeFi lending protocol.
Wallet: ${walletAddress} (Age: ${onChainData.walletAgeDays} days, DeFi interactions: ${onChainData.deFiInteractions.length})
Financial: ${financialContext}
Provide a 2-sentence explanation of their creditworthiness.`;
                const aiResult = await model.generateContent(prompt);
                explanation = aiResult.response.text();
            } catch (error) {
                console.error("[score] AI explanation failed, using fallback:", error);
            }
        }

        // 6. Assemble Final Score
        const kiteScore = assembleKiteScore({
            onChain: onChainScore,
            financial: financialScore,
            github: githubScore,
        }, explanation);

        // 7. Generate ZK Attestation
        const attestation = generateAttestation(kiteScore);

        return successResponse({
            score: kiteScore,
            attestation,
        });

    } catch (error) {
        console.error("[score] Scoring error:", error);
        return errorResponse("Calculation failed", 500);
    }
}
