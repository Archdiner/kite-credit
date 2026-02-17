// ---------------------------------------------------------------------------
// GET /api/user/connections
// ---------------------------------------------------------------------------
// Returns which data sources are connected for the current user.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { getUserFromToken, extractAccessToken, getAllConnections } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);

        if (!user) {
            return errorResponse("Unauthorized", 401);
        }

        const connections = await getAllConnections(user.id);

        // Transform to a simpler format
        const connected: Record<string, { connected: boolean; identifier: string | null; connectedAt: string | null }> = {
            solana_wallet: { connected: false, identifier: null, connectedAt: null },
            github: { connected: false, identifier: null, connectedAt: null },
            plaid: { connected: false, identifier: null, connectedAt: null },
        };

        for (const conn of connections) {
            if (connected[conn.provider]) {
                connected[conn.provider] = {
                    connected: true,
                    identifier: conn.provider_user_id,
                    connectedAt: conn.connected_at,
                };
            }
        }

        return successResponse(connected);
    } catch (error) {
        console.error("[user/connections] Error:", error);
        return errorResponse("Failed to get connections", 500);
    }
}
