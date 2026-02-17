// ---------------------------------------------------------------------------
// GET /api/github/analyze
// ---------------------------------------------------------------------------
// Reads the GitHub token from the HTTP-only cookie, fetches user data
// from GitHub's API, and returns the professional sub-score (0-300).
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
import { analyzeGitHub, scoreGitHub } from "@/lib/github";

export async function GET(request: NextRequest) {
    // Rate limit
    const ip = getClientIp(request);
    const limit = rateLimit(ip);
    if (!limit.allowed) return rateLimitedResponse();

    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("github_token")?.value;

        if (!token) {
            return errorResponse("GitHub not connected. Please authorize first.", 401);
        }

        const data = await analyzeGitHub(token);
        const score = scoreGitHub(data);

        return successResponse({
            data,
            score,
        });
    } catch (err) {
        console.error("[github/analyze] Error:", err);
        return errorResponse("Failed to analyze GitHub profile. Please try again.", 500);
    }
}
