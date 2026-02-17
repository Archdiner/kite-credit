// ---------------------------------------------------------------------------
// POST /api/reclaim/callback
// ---------------------------------------------------------------------------
// Receives proof callbacks from Reclaim Protocol after user completes
// bank verification. Processes the proof and returns financial data.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { processProof, scoreFinancial, verifyProof } from "@/lib/reclaim";

export async function POST(request: NextRequest) {
    try {
        const proof = await request.json();
        const sessionId = request.headers.get("x-reclaim-session-id");

        if (!sessionId) {
            console.error("[reclaim/callback] Missing X-Reclaim-Session-Id header");
            return errorResponse("Missing session ID.", 400);
        }

        // 2. Validate Proof Structure
        if (!proof || !proof.claimData) {
            return errorResponse("Invalid proof format.", 400);
        }

        // 3. Verify Proof Signature (SDK)
        // This is the critical security check.
        try {
            const isValid = await verifyProof(proof);
            if (!isValid) {
                console.error("[reclaim/callback] Proof verification failed");
                return errorResponse("Invalid proof signature.", 401);
            }
        } catch (verifyError) {
            console.error("[reclaim/callback] Proof verification error:", verifyError);
            return errorResponse("Proof verification failed.", 401);
        }

        const data = processProof(proof);
        const score = scoreFinancial(data);

        return successResponse({
            data,
            score,
        });
    } catch (err) {
        console.error("[reclaim/callback] Error:", err);
        return errorResponse("Failed to process proof.", 500);
    }
}
