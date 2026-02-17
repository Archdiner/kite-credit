// ---------------------------------------------------------------------------
// GET /api/auth/session
// ---------------------------------------------------------------------------
// Returns the current user's session info + connection status.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { getUserFromToken, extractAccessToken, getAllConnections, getLatestScore } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);

        if (!user) {
            return successResponse({ user: null, connections: [], latestScore: null });
        }

        // Fetch connections and latest score in parallel
        const [connections, latestScore] = await Promise.all([
            getAllConnections(user.id),
            getLatestScore(user.id),
        ]);

        return successResponse({
            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.display_name || "",
            },
            connections,
            latestScore: latestScore
                ? {
                    total: latestScore.total_score,
                    tier: latestScore.tier,
                    breakdown: latestScore.breakdown,
                    githubBonus: latestScore.github_bonus,
                    explanation: latestScore.explanation,
                    attestation: latestScore.attestation,
                    sources: latestScore.sources,
                    timestamp: latestScore.calculated_at,
                }
                : null,
        });
    } catch (error) {
        console.error("[auth/session] Error:", error);
        return errorResponse("Failed to get session", 500);
    }
}
