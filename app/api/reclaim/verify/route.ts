// ---------------------------------------------------------------------------
// POST /api/reclaim/verify
// ---------------------------------------------------------------------------
// Initiates a Reclaim Protocol verification or uses mock data for
// development. Returns the financial sub-score (0-300).
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    rateLimit,
    rateLimitedResponse,
    getClientIp,
} from "@/lib/api-utils";
import { generateMockProof, scoreFinancial, initiateVerification } from "@/lib/reclaim";

export async function POST(request: NextRequest) {
    // Rate limit
    const ip = getClientIp(request);
    const limit = rateLimit(ip);
    if (!limit.allowed) return rateLimitedResponse();

    try {
        const body = await request.json();
        const { mode = "mock", balance, incomeConsistent, provider } = body;

        const appId = process.env.RECLAIM_APP_ID;
        const appSecret = process.env.RECLAIM_APP_SECRET;

        if (mode === "live" && appId && appSecret) {
            // Attempt live Reclaim verification
            try {
                const session = await initiateVerification(appId, appSecret);
                return successResponse({
                    mode: "live",
                    verificationUrl: session.requestUrl,
                    statusUrl: session.statusUrl,
                    message: "Open the verification URL to complete bank verification.",
                });
            } catch {
                // Fall back to mock if Reclaim is unavailable
                console.warn("[reclaim/verify] Live verification failed, falling back to mock");
            }
        }

        // Mock verification for development
        const data = generateMockProof({
            balance: balance ?? 15000,
            incomeConsistent: incomeConsistent ?? true,
            provider: provider ?? "chase_mock",
        });
        const score = scoreFinancial(data);

        return successResponse({
            mode: "mock",
            data,
            score,
        });
    } catch (err) {
        console.error("[reclaim/verify] Error:", err);
        return errorResponse("Failed to verify financial data. Please try again.", 500);
    }
}
