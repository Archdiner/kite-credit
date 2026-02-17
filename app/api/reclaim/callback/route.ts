// ---------------------------------------------------------------------------
// POST /api/reclaim/callback
// ---------------------------------------------------------------------------
// Receives proof callbacks from Reclaim Protocol after user completes
// bank verification. Processes the proof and returns financial data.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { processProof, scoreFinancial } from "@/lib/reclaim";

export async function POST(request: NextRequest) {
    try {
        const proof = await request.json();

        if (!proof || !proof.claimData) {
            return errorResponse("Invalid proof format.", 400);
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
