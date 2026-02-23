// ---------------------------------------------------------------------------
// DELETE /api/lender/webhooks/:id — Remove a webhook subscription
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required", 401);
    }

    const { id } = await params;

    const supabase = createServerSupabaseClient();

    // Ownership check: only delete if the webhook belongs to this lender
    const { data, error } = await supabase
        .from("lender_webhooks")
        .delete()
        .eq("id", id)
        .eq("lender_id", lender.id)
        .select("id")
        .single();

    if (error || !data) {
        return errorResponse("Webhook not found or not owned by this API key", 404);
    }

    return successResponse({ deleted: true, id: data.id });
}
