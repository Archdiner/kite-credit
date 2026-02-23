// ---------------------------------------------------------------------------
// Webhook Dispatch — Signing, delivery, and circuit breaker
// ---------------------------------------------------------------------------

import { createHmac } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase";

const WEBHOOK_TIMEOUT_MS = 10_000;
const CIRCUIT_BREAKER_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// HMAC signing
// ---------------------------------------------------------------------------

export function signWebhookPayload(payload: string, secret: string): string {
    return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

// ---------------------------------------------------------------------------
// Single webhook delivery
// ---------------------------------------------------------------------------

interface WebhookRecord {
    id: string;
    url: string;
    secret: string;
    failure_count: number;
}

export async function dispatchWebhook(
    webhook: WebhookRecord,
    event: string,
    payload: Record<string, unknown>
): Promise<void> {
    const supabase = createServerSupabaseClient();
    const body = JSON.stringify(payload);
    const signature = signWebhookPayload(body, webhook.secret);

    let statusCode: number | null = null;
    let error: string | null = null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

        const res = await fetch(webhook.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Kite-Signature": signature,
                "X-Kite-Event": event,
            },
            body,
            signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = res.status;

        if (!res.ok) {
            error = `HTTP ${res.status}`;
        }
    } catch (err) {
        error = err instanceof Error ? err.message : "Unknown error";
    }

    // Log delivery
    await supabase.from("lender_webhook_deliveries").insert({
        webhook_id: webhook.id,
        event,
        payload,
        status_code: statusCode,
        error,
    });

    // Circuit breaker: increment failure_count on error, reset on success
    if (error) {
        const newCount = webhook.failure_count + 1;
        const updates: Record<string, unknown> = { failure_count: newCount, updated_at: new Date().toISOString() };
        if (newCount >= CIRCUIT_BREAKER_THRESHOLD) {
            updates.active = false;
        }
        await supabase.from("lender_webhooks").update(updates).eq("id", webhook.id);
    } else if (webhook.failure_count > 0) {
        await supabase
            .from("lender_webhooks")
            .update({ failure_count: 0, updated_at: new Date().toISOString() })
            .eq("id", webhook.id);
    }
}

// ---------------------------------------------------------------------------
// Dispatch score.updated to all subscribed webhooks for a wallet
// ---------------------------------------------------------------------------

export async function dispatchScoreChanged(
    walletAddress: string,
    scoreData: { score: number; tier: string; issued_at: string }
): Promise<void> {
    const supabase = createServerSupabaseClient();

    const { data: webhooks } = await supabase
        .from("lender_webhooks")
        .select("id, url, secret, failure_count")
        .eq("wallet_address", walletAddress)
        .eq("active", true)
        .contains("events", ["score.updated"]);

    if (!webhooks || webhooks.length === 0) return;

    const payload = {
        event: "score.updated",
        wallet_address: walletAddress,
        ...scoreData,
        timestamp: new Date().toISOString(),
    };

    // Fire all in parallel — fire-and-forget
    await Promise.allSettled(
        webhooks.map((wh) => dispatchWebhook(wh, "score.updated", payload))
    );
}
