// ---------------------------------------------------------------------------
// POST /api/lender/rotate-key — Generate new API key, invalidate old one
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey, generateApiKey, checkLenderRateLimit } from "@/lib/api-key-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required", 401);
    }

    const { success } = await checkLenderRateLimit(lender.id, "rotate-key", lender.rate_limit);
    if (!success) return errorResponse("Rate limit exceeded", 429);

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
        .from("lender_api_keys")
        .update({
            key_hash: keyHash,
            key_prefix: keyPrefix,
            updated_at: new Date().toISOString(),
        })
        .eq("id", lender.id);

    if (error) {
        console.error("[lender/rotate-key] Update failed:", error);
        return errorResponse("Failed to rotate key", 500);
    }

    return successResponse({
        api_key: rawKey,
        key_prefix: keyPrefix,
        warning: "Store this key securely — it will not be shown again.",
    });
}
