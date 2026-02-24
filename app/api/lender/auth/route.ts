// ---------------------------------------------------------------------------
// POST /api/lender/auth — Validate API key, return lender dashboard data
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey, checkLenderRateLimit } from "@/lib/api-key-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import type { LenderDashboardData } from "@/types";

export async function POST(req: NextRequest) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required", 401);
    }

    const { success } = await checkLenderRateLimit(lender.id, "auth", lender.rate_limit);
    if (!success) return errorResponse("Rate limit exceeded", 429);

    const supabase = createServerSupabaseClient();

    // Get created_at (not returned by authenticateApiKey)
    const { data: keyRow } = await supabase
        .from("lender_api_keys")
        .select("created_at")
        .eq("id", lender.id)
        .single();

    // Count webhooks
    const { count: totalWebhooks } = await supabase
        .from("lender_webhooks")
        .select("id", { count: "exact", head: true })
        .eq("lender_id", lender.id);

    const { count: activeWebhooks } = await supabase
        .from("lender_webhooks")
        .select("id", { count: "exact", head: true })
        .eq("lender_id", lender.id)
        .eq("active", true);

    const data: LenderDashboardData = {
        id: lender.id,
        name: lender.name,
        email: lender.email,
        key_prefix: lender.key_prefix,
        rate_limit: lender.rate_limit,
        active: lender.active,
        created_at: keyRow?.created_at ?? new Date().toISOString(),
        total_webhooks: totalWebhooks ?? 0,
        active_webhooks: activeWebhooks ?? 0,
    };

    return successResponse(data);
}
