import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { fetchGitHubData, scoreGitHub } from "@/lib/github";
import { generateAttestation } from "@/lib/attestation";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getUserFromToken, getConnection, decryptToken, upsertConnection, saveScore } from "@/lib/auth";
import { getTier } from "@/lib/scoring";
import type { KiteScore, ScoreBreakdown, FiveFactorBreakdown } from "@/types";

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "unknown";
        const { success, reset } = await checkRateLimit("score-gh:" + ip, 5, 60);

        if (!success) {
            return new Response(JSON.stringify({ error: "Too many requests" }), {
                status: 429,
                headers: { "Retry-After": String(reset - Math.floor(Date.now() / 1000)) },
            });
        }

        const cookieStore = await cookies();
        let userId: string | null = null;

        try {
            const sbToken = cookieStore.get("sb-access-token")?.value;
            const user = await getUserFromToken(sbToken);
            if (user) userId = user.id;
        } catch { /* Non-fatal */ }

        let githubToken = cookieStore.get("github_token")?.value;

        if (!githubToken && userId) {
            try {
                const ghConn = await getConnection(userId, "github");
                if (ghConn?.access_token_encrypted) {
                    githubToken = decryptToken(ghConn.access_token_encrypted);
                }
            } catch {
                console.error("[score/github-only] Failed to decrypt stored GitHub token");
            }
        }

        if (!githubToken) {
            return errorResponse("GitHub not connected. Please authorize first.", 401);
        }

        let githubData = null;
        if (userId) {
            const ghConn = await getConnection(userId, "github");
            const cached = ghConn?.metadata?.github_data;
            const cachedAt = ghConn?.metadata?.github_data_cached_at;
            if (cached && cachedAt) {
                const ageHrs = (Date.now() - new Date(cachedAt as string).getTime()) / (1000 * 60 * 60);
                if (ageHrs < 24) githubData = cached;
            }
        }

        if (!githubData) {
            githubData = await fetchGitHubData(githubToken);
            if (userId) {
                try {
                    await upsertConnection(userId, "github", githubData.username, null, {
                        github_data: githubData,
                        github_data_cached_at: new Date().toISOString(),
                    });
                } catch { /* Non-fatal cache write */ }
            }
        }

        const githubScore = scoreGitHub(githubData);
        const devScoreNormalized = Math.min(1000, Math.floor((githubScore.score / 300) * 1000));
        const tier = getTier(devScoreNormalized);

        let explanation = "Your Developer Score reflects your GitHub activity, code quality, and community reputation. This score focuses on technical credibility rather than financial history.";

        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                const prompt = `Analyze this developer profile for a decentralized reputation protocol.
GitHub: ${githubData.username} (Account age: ${githubData.accountAgeDays} days, Repos: ${githubData.publicRepos}, Stars: ${githubData.totalStars}, Followers: ${githubData.followers}, Recent commits: ${githubData.recentCommitCount})
Developer Score: ${githubScore.score}/300

Provide a 2-sentence explanation of their developer reputation and technical credibility. Focus on code quality, consistency, and community standing.`;

                const aiResult = await model.generateContent(prompt);
                const responseText = aiResult.response.text();
                if (responseText) explanation = responseText;
            } catch (error) {
                console.error("[score/github-only] AI explanation failed:", error);
            }
        }

        const emptyFiveFactor: FiveFactorBreakdown = {
            paymentHistory: { score: 0, details: { onChainRepayments: 0, bankBillPay: 0 } },
            utilization: { score: 0, details: { creditUtilization: 0, collateralHealth: 0, balanceRatio: 0 } },
            creditAge: { score: 0, details: { walletAge: 0, accountAge: 0 } },
            creditMix: { score: 0, details: { protocolDiversity: 0, accountDiversity: 0 } },
            newCredit: { score: 0, details: { recentInquiries: 0, recentOpenings: 0 } },
        };

        const kiteScore: KiteScore = {
            total: devScoreNormalized,
            tier,
            breakdown: {
                onChain: { score: 0, breakdown: { walletAge: 0, deFiActivity: 0, repaymentHistory: 0, staking: 0, stablecoinCapital: 0 } },
                financial: null,
                github: githubScore,
                fiveFactor: emptyFiveFactor,
            } as ScoreBreakdown,
            githubBonus: 0,
            explanation,
            timestamp: new Date().toISOString(),
        };

        const attestation = generateAttestation(kiteScore);

        if (userId) {
            try {
                const sources = ["github_linked"];
                await saveScore(userId, kiteScore, attestation, sources);
            } catch (dbError) {
                console.error("[score/github-only] Failed to persist score:", dbError);
            }
        }

        return successResponse({
            score: kiteScore,
            attestation,
            githubOnly: true,
        });

    } catch (error) {
        console.error("[score/github-only] Error:", error);
        return errorResponse("Developer score calculation failed", 500);
    }
}
