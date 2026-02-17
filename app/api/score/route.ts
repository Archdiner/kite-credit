// ---------------------------------------------------------------------------
// POST /api/score
// ---------------------------------------------------------------------------
// Accepts sub-scores (or references to connected sources), computes the
// Kite Score via the Lift Equation, generates an AI explanation, and
// returns the full score object.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
    successResponse,
    errorResponse,
    rateLimit,
    rateLimitedResponse,
    getClientIp,
} from "@/lib/api-utils";
import { analyzeWallet, scoreOnChain } from "@/lib/solana";
import { analyzeGitHub, scoreGitHub } from "@/lib/github";
import { generateMockProof, scoreFinancial } from "@/lib/reclaim";
import { assembleKiteScore, getConnectedSources, calculateKiteScore } from "@/lib/scoring";
import { generateScoreExplanation } from "@/lib/gemini";
import { generateAttestation } from "@/lib/attestation";
import type { ScoreBreakdown } from "@/types";

export async function POST(request: NextRequest) {
    // Rate limit
    const ip = getClientIp(request);
    const limit = rateLimit(ip);
    if (!limit.allowed) return rateLimitedResponse();

    try {
        const body = await request.json();
        const { walletAddress, includeFinancial = false, financialBalance } = body;

        const breakdown: ScoreBreakdown = {
            onChain: null,
            github: null,
            financial: null,
        };

        // On-chain scoring (if wallet provided)
        if (walletAddress) {
            try {
                const onChainData = await analyzeWallet(walletAddress);
                breakdown.onChain = scoreOnChain(onChainData);
            } catch (err) {
                console.error("[score] On-chain analysis error:", err);
                // Continue without on-chain score
            }
        }

        // GitHub scoring (if token cookie exists)
        const cookieStore = await cookies();
        const githubToken = cookieStore.get("github_token")?.value;
        if (githubToken) {
            try {
                const githubData = await analyzeGitHub(githubToken);
                breakdown.github = scoreGitHub(githubData);
            } catch (err) {
                console.error("[score] GitHub analysis error:", err);
                // Continue without GitHub score
            }
        }

        // Financial scoring (if requested)
        if (includeFinancial) {
            try {
                const financialData = generateMockProof({
                    balance: financialBalance ?? 15000,
                    incomeConsistent: true,
                });
                breakdown.financial = scoreFinancial(financialData);
            } catch (err) {
                console.error("[score] Financial analysis error:", err);
            }
        }

        // Calculate total
        const connectedSources = getConnectedSources(breakdown);

        if (connectedSources.length === 0) {
            return errorResponse(
                "No data sources connected. Connect at least one source to generate a score.",
                400
            );
        }

        const { total, tier } = calculateKiteScore(breakdown);

        // Generate AI explanation
        const explanation = await generateScoreExplanation({
            total,
            tier,
            breakdown,
            connectedSources,
        });

        const kiteScore = assembleKiteScore(breakdown, explanation);
        const attestation = generateAttestation(kiteScore);

        return successResponse({
            score: kiteScore,
            attestation,
        });
    } catch (err) {
        console.error("[score] Error:", err);
        return errorResponse("Failed to calculate score. Please try again.", 500);
    }
}
