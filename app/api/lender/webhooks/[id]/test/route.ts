// ---------------------------------------------------------------------------
// POST /api/lender/webhooks/:id/test — Send a synthetic test payload
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { signWebhookPayload } from "@/lib/webhook";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required", 401);
    }

    const { id } = await params;
    const supabase = createServerSupabaseClient();

    // Ownership check + fetch webhook details
    const { data: webhook } = await supabase
        .from("lender_webhooks")
        .select("id, url, secret, wallet_address")
        .eq("id", id)
        .eq("lender_id", lender.id)
        .single();

    if (!webhook) {
        return errorResponse("Webhook not found or not owned by this API key", 404);
    }

    const testPayload = {
        event: "test",
        wallet_address: webhook.wallet_address,
        score: 750,
        tier: "Strong",
        issued_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        _test: true,
    };

    const body = JSON.stringify(testPayload);
    const signature = signWebhookPayload(body, webhook.secret);

    let statusCode: number | null = null;
    let deliveryError: string | null = null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(webhook.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Kite-Signature": signature,
                "X-Kite-Event": "test",
            },
            body,
            signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = res.status;

        if (!res.ok) {
            deliveryError = `HTTP ${res.status}`;
        }
    } catch (err) {
        deliveryError = err instanceof Error ? err.message : "Unknown error";
    }

    // Log delivery (does NOT affect circuit breaker failure_count)
    await supabase.from("lender_webhook_deliveries").insert({
        webhook_id: webhook.id,
        event: "test",
        payload: testPayload,
        status_code: statusCode,
        error: deliveryError,
    });

    return successResponse({
        status_code: statusCode,
        error: deliveryError,
    });
}
