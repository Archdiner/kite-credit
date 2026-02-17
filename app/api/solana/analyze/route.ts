// ---------------------------------------------------------------------------
// POST /api/solana/analyze
// ---------------------------------------------------------------------------
// Accepts a Solana wallet address, analyzes on-chain activity, and returns
// the on-chain sub-score (0-400) with detailed breakdown.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    rateLimit,
    rateLimitedResponse,
    getClientIp,
} from "@/lib/api-utils";
import { analyzeSolanaData as analyzeWallet, scoreOnChain } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";

export async function POST(request: NextRequest) {
    // Rate limit
    const ip = getClientIp(request);
    const limit = rateLimit(ip);
    if (!limit.allowed) return rateLimitedResponse();

    try {
        const body = await request.json();
        const { address } = body;

        if (!address || typeof address !== "string") {
            return errorResponse("Missing or invalid wallet address.", 400);
        }

        // Validate it is a legitimate Solana address
        try {
            new PublicKey(address);
        } catch {
            return errorResponse("Invalid Solana address format.", 400);
        }

        // Analyze on-chain activity
        const data = await analyzeWallet(address);
        const score = scoreOnChain(data);

        return successResponse({
            data,
            score,
        });
    } catch (err) {
        console.error("[solana/analyze] Error:", err);
        return errorResponse("Failed to analyze wallet. Please try again.", 500);
    }
}
