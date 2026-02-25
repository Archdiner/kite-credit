// ---------------------------------------------------------------------------
// GET  /api/user/link-wallet — return a nonce for the client to sign
// POST /api/user/link-wallet — link an Ethereum wallet via signature proof
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { recoverMessageAddress } from "viem";
import { getUserFromToken } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase";
import { successResponse, errorResponse } from "@/lib/api-utils";

const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

// ---------------------------------------------------------------------------
// GET — stateless nonce generation
// ---------------------------------------------------------------------------

export async function GET() {
    const nonce = `Link this wallet to Kite Credit: ${randomBytes(16).toString("hex")}`;
    return successResponse({ nonce });
}

// ---------------------------------------------------------------------------
// POST — verify signature and upsert ethereum_wallet connection
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const user = await getUserFromToken(token);
    if (!user) {
        return errorResponse("Authentication required", 401);
    }

    let body: { address?: string; signature?: string; nonce?: string };
    try {
        body = await req.json();
    } catch {
        return errorResponse("Invalid request body", 400);
    }

    const { address, signature, nonce } = body;

    if (!address || !ETH_ADDRESS_REGEX.test(address)) {
        return errorResponse("Invalid Ethereum address", 400);
    }
    if (!signature || !nonce) {
        return errorResponse("signature and nonce are required", 400);
    }

    // Verify the signature — recovered address must match the claimed address
    let recovered: string;
    try {
        recovered = await recoverMessageAddress({
            message: nonce,
            signature: signature as `0x${string}`,
        });
    } catch {
        return errorResponse("Invalid signature", 400);
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
        return errorResponse("Signature does not match address", 400);
    }

    // Upsert the connection
    const supabase = createServerSupabaseClient();
    const { error } = await supabase
        .from("user_connections")
        .upsert(
            {
                user_id: user.id,
                provider: "ethereum_wallet",
                provider_user_id: address.toLowerCase(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,provider" }
        );

    if (error) {
        console.error("[link-wallet] Upsert failed:", error);
        return errorResponse("Failed to link wallet", 500);
    }

    return successResponse({
        linked: true,
        address: address.toLowerCase(),
        chain: "ethereum",
    });
}
