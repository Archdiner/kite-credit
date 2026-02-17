// ---------------------------------------------------------------------------
// POST /api/user/wallet
// ---------------------------------------------------------------------------
// Saves the user's wallet address to user_connections.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { getUserFromToken, extractAccessToken, upsertConnection } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);

        if (!user) {
            return errorResponse("Unauthorized", 401);
        }

        const { walletAddress } = await request.json();

        if (!walletAddress || typeof walletAddress !== "string") {
            return errorResponse("Missing wallet address", 400);
        }

        await upsertConnection(user.id, "solana_wallet", walletAddress);

        return successResponse({ saved: true });
    } catch (error) {
        console.error("[user/wallet] Error:", error);
        return errorResponse("Failed to save wallet", 500);
    }
}
