// ---------------------------------------------------------------------------
// Main Scoring API Route
// ---------------------------------------------------------------------------
// Calculates the user's Kite Score based on:
// 1. Wallet signature verification (auth)
// 2. On-chain data analysis (50%)
// 3. Financial data analysis via Plaid (50%)
// 4. GitHub data analysis (bonus)
// 5. Persists score to database if user is authenticated
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyWalletSignature } from "@/lib/wallet-verify";
import { analyzeSolanaData, scoreOnChain } from "@/lib/solana";
import { fetchGitHubData, scoreGitHub } from "@/lib/github";
import { plaidClient } from "@/lib/plaid";
import { scoreFinancial } from "@/lib/reclaim";
import { assembleKiteScore } from "@/lib/scoring";
import { getConnectedSources } from "@/lib/scoring";
import { generateAttestation } from "@/lib/attestation";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getUserFromToken, getConnection, decryptToken, saveScore, upsertConnection } from "@/lib/auth";
import { dispatchScoreChanged } from "@/lib/webhook";

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "unknown";
        const { success, reset } = await checkRateLimit("score:" + ip, 5, 60);

        if (!success) {
            return new Response(JSON.stringify({ error: "Too many requests" }), {
                status: 429,
                headers: {
                    "Retry-After": String(reset - Math.floor(Date.now() / 1000)),
                },
            });
        }

        const body = await req.json();
        const cookieStore = await cookies();
        let plaidAccessToken = cookieStore.get("plaid_access_token")?.value;

        const { walletAddress, walletSignature, includeGithub } = body;

        // Validate walletAddress is present and well-formed (base58, 32-44 chars)
        if (!walletAddress || typeof walletAddress !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
            return errorResponse("Missing or invalid wallet address", 400);
        }

        // Try to get authenticated user for DB persistence
        let userId: string | null = null;
        try {
            const sbToken = cookieStore.get("sb-access-token")?.value;
            const user = await getUserFromToken(sbToken);
            if (user) {
                userId = user.id;

                // Verify wallet ownership via signature when provided (desktop).
                // Authenticated mobile users submit an address without a signature;
                // they are still rate-limited and tied to their session.
                if (walletSignature) {
                    let nonce = "";
                    let signature = "";
                    if (walletSignature.includes(":")) {
                        const parts = walletSignature.split(":");
                        nonce = parts[0].trim();
                        signature = parts[1].trim();
                    } else {
                        signature = walletSignature;
                    }
                    if (!verifyWalletSignature(walletAddress, nonce, signature)) {
                        return errorResponse("Invalid wallet signature", 401);
                    }
                }

                // CHECK CACHE: If the user has a recent score (last 5 mins), return it
                // This prevents score fluctuation due to RPC instability on refresh
                const { data: latestScore } = await (await import("@/lib/auth")).getLatestScore(userId);
                if (latestScore) {
                    const lastCalc = new Date(latestScore.calculated_at).getTime();
                    const now = Date.now();
                    const diffMins = (now - lastCalc) / (1000 * 60);

                    if (diffMins < 5) {
                        return successResponse({
                            score: {
                                total: latestScore.total_score,
                                tier: latestScore.tier,
                                breakdown: latestScore.breakdown,
                                githubBonus: latestScore.github_bonus,
                                explanation: latestScore.explanation,
                                timestamp: latestScore.calculated_at,
                            },
                            attestation: latestScore.attestation,
                            cached: true
                        });
                    }
                }

                // If no Plaid cookie, try loading from DB
                if (!plaidAccessToken) {
                    const plaidConn = await getConnection(user.id, "plaid");
                    if (plaidConn?.access_token_encrypted) {
                        try {
                            plaidAccessToken = decryptToken(plaidConn.access_token_encrypted);
                        } catch {
                            console.error("[score] Failed to decrypt stored Plaid token");
                        }
                    }
                }
            }
        } catch {
            // Non-fatal: continue without DB context
        }

        if (!userId && !walletSignature) {
            return errorResponse("Authentication or wallet signature required", 401);
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
                    proofHash: "plaid_verified_" + walletAddress.slice(0, 8),
                    balanceBracket,
                    incomeConsistency,
                    provider: "plaid"
                });

                financialContext = `Bank connected via Plaid. Total balance: $${totalBalance.toFixed(2)}. Transactions: ${txRes.data.transactions.length}.`;
            } catch (error) {
                console.error("[score] Plaid fetch failed:", error);
            }
        }

        // 4. GitHub Bonus (Optional) — with 24h data cache
        let githubScore = null;
        if (includeGithub) {
            let githubToken = cookieStore.get("github_token")?.value;

            if (!githubToken && userId) {
                try {
                    const ghConn = await getConnection(userId, "github");
                    if (ghConn?.access_token_encrypted) {
                        githubToken = decryptToken(ghConn.access_token_encrypted);
                    }
                } catch {
                    console.error("[score] Failed to decrypt stored GitHub token");
                }
            }

            if (githubToken) {
                try {
                    // Check for cached GitHubData (24h TTL) to avoid hitting API every time
                    let githubData = null;
                    if (userId) {
                        const ghConn = await getConnection(userId, "github");
                        const cached = ghConn?.metadata?.github_data;
                        const cachedAt = ghConn?.metadata?.github_data_cached_at;
                        if (cached && cachedAt) {
                            const ageHrs = (Date.now() - new Date(cachedAt as string).getTime()) / (1000 * 60 * 60);
                            if (ageHrs < 24) {
                                githubData = cached;
                            }
                        }
                    }

                    if (!githubData) {
                        githubData = await fetchGitHubData(githubToken);
                        // Cache the data for next time
                        if (userId) {
                            try {
                                await upsertConnection(userId, "github", githubData.username, null, {
                                    github_data: githubData,
                                    github_data_cached_at: new Date().toISOString(),
                                });
                            } catch { /* Non-fatal cache write */ }
                        }
                    }

                    githubScore = scoreGitHub(githubData);
                } catch (error) {
                    console.error("[score] GitHub fetch failed:", error);
                }
            }
        }

        // 5. AI Explanation (graceful fallback if Gemini unavailable)
        let explanation = "Your Kite Score is currently based on your on-chain activity and developer reputation.";

        if (process.env.GEMINI_API_KEY) {
            try {
                // Dynamic import to avoid startup crashes if package is missing
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                let promptContext = `Wallet: ${walletAddress} (Age: ${onChainData.walletAgeDays} days, DeFi interactions: ${onChainData.deFiInteractions.length}, Balance: ${onChainData.solBalance} SOL, Stablecoins: $${onChainData.stablecoinBalance.toFixed(2)} USDC/USDT)\n`;

                if (financialScore) {
                    promptContext += `Financial: ${financialContext}\n`;
                } else {
                    promptContext += `Financial: Not connected (User is relying on decentralized reputation only).\n`;
                }

                if (githubScore) {
                    promptContext += `GitHub: Connected (Score contribution: ${githubScore.score})\n`;
                }

                const prompt = `Analyze this credit profile for a DeFi lending protocol.
${promptContext}
Provide a 2-sentence explanation of their creditworthiness based heavily on their on-chain behavior and consistency. Do not mention missing bank data negatively.`;

                const aiResult = await model.generateContent(prompt);
                const responseText = aiResult.response.text();
                if (responseText) explanation = responseText;
            } catch (error) {
                console.error("[score] AI explanation failed, using fallback:", error);
            }
        }

        // 5b. Count secondary wallets for trust boost
        let secondaryWalletCount = 0;
        if (userId) {
            try {
                const walletConn = await getConnection(userId, "solana_wallet");
                const wallets = walletConn?.metadata?.wallets;
                if (Array.isArray(wallets)) {
                    secondaryWalletCount = Math.max(0, wallets.length - 1);
                }
            } catch { /* Non-fatal */ }
        }

        // 6. Assemble Final Score
        const kiteScore = assembleKiteScore({
            onChain: onChainScore,
            financial: financialScore,
            github: githubScore,
            secondaryWalletCount,
        }, explanation);

        // 7. Generate ZK Attestation
        const attestation = generateAttestation(kiteScore);

        // 8. Persist to database if authenticated
        if (userId) {
            try {
                const sources = getConnectedSources(kiteScore.breakdown);
                await saveScore(userId, kiteScore, attestation, sources);

                // Fire-and-forget: notify lender webhooks subscribed to this wallet
                dispatchScoreChanged(walletAddress, {
                    score: kiteScore.total,
                    tier: kiteScore.tier,
                    issued_at: attestation.issued_at,
                }).catch((err) => console.error("[score] Webhook dispatch error:", err));
            } catch (dbError) {
                console.error("[score] Failed to persist score:", dbError);
                // Non-fatal: still return the score
            }
        }

        return successResponse({
            score: kiteScore,
            attestation,
        });

    } catch (error) {
        console.error("[score] Scoring error:", error);
        return errorResponse("Calculation failed", 500);
    }
}
