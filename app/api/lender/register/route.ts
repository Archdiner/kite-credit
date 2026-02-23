// ---------------------------------------------------------------------------
// POST /api/lender/register — Register for a Kite Credit API key
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { successResponse, errorResponse, getClientIp } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    const { success } = await checkRateLimit("lender-register:" + ip, 5, 3600);

    if (!success) {
        return errorResponse("Too many registration attempts. Try again later.", 429);
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return errorResponse("Invalid JSON body", 400);
    }

    const { name, email, use_case } = body as { name?: string; email?: string; use_case?: string };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("name is required", 400);
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
        return errorResponse("Valid email is required", 400);
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("lender_api_keys").insert({
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: name.trim(),
        email: email.trim(),
        use_case: typeof use_case === "string" ? use_case.trim() : null,
    });

    if (error) {
        console.error("[lender/register] Insert failed:", error);
        return errorResponse("Registration failed", 500);
    }

    return successResponse({
        api_key: rawKey,
        key_prefix: keyPrefix,
        rate_limit: 1000,
        message: "Store this API key securely — it will not be shown again.",
    }, 201);
}
