// ---------------------------------------------------------------------------
// GET /api/lender/webhooks/:id/deliveries — Recent delivery logs
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required", 401);
    }

    const { id } = await params;
    const supabase = createServerSupabaseClient();

    // Ownership check
    const { data: webhook } = await supabase
        .from("lender_webhooks")
        .select("id")
        .eq("id", id)
        .eq("lender_id", lender.id)
        .single();

    if (!webhook) {
        return errorResponse("Webhook not found or not owned by this API key", 404);
    }

    const { data: deliveries, error } = await supabase
        .from("lender_webhook_deliveries")
        .select("id, event, payload, status_code, error, delivered_at")
        .eq("webhook_id", id)
        .order("delivered_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("[lender/deliveries] Query failed:", error);
        return errorResponse("Failed to fetch deliveries", 500);
    }

    return successResponse({ deliveries: deliveries ?? [] });
}
