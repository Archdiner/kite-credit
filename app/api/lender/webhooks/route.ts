// ---------------------------------------------------------------------------
// POST /api/lender/webhooks — Register a webhook subscription
// GET  /api/lender/webhooks — List lender's webhooks
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey, checkLenderRateLimit } from "@/lib/api-key-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const VALID_EVENTS = ["score.updated"];

export async function POST(req: NextRequest) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required", 401);
    }

    const { success } = await checkLenderRateLimit(lender.id, "webhooks", lender.rate_limit);
    if (!success) return errorResponse("Rate limit exceeded", 429);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return errorResponse("Invalid JSON body", 400);
    }

    const { wallet_address, url, events } = body as {
        wallet_address?: string;
        url?: string;
        events?: string[];
    };

    if (!wallet_address || !SOLANA_ADDRESS_REGEX.test(wallet_address)) {
        return errorResponse("Valid Solana wallet_address is required", 400);
    }

    if (!url || typeof url !== "string") {
        return errorResponse("url is required", 400);
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
            return errorResponse("Webhook URL must use HTTPS", 400);
        }
    } catch {
        return errorResponse("Invalid webhook URL", 400);
    }

    const eventList = events ?? ["score.updated"];
    const invalidEvents = eventList.filter((e) => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
        return errorResponse(`Invalid events: ${invalidEvents.join(", ")}. Valid: ${VALID_EVENTS.join(", ")}`, 400);
    }

    const secret = randomBytes(32).toString("hex");
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
        .from("lender_webhooks")
        .insert({
            lender_id: lender.id,
            wallet_address,
            url,
            events: eventList,
            secret,
        })
        .select("id, wallet_address, url, events, active, created_at")
        .single();

    if (error) {
        if (error.code === "23505") {
            return errorResponse("Webhook already exists for this wallet + URL", 409);
        }
        console.error("[lender/webhooks] Insert failed:", error);
        return errorResponse("Failed to create webhook", 500);
    }

    return successResponse({
        ...data,
        secret,
        message: "Store the secret securely — it is used to verify webhook signatures.",
    }, 201);
}

export async function GET(req: NextRequest) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required", 401);
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
        .from("lender_webhooks")
        .select("id, wallet_address, url, events, active, failure_count, created_at")
        .eq("lender_id", lender.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[lender/webhooks] List failed:", error);
        return errorResponse("Failed to list webhooks", 500);
    }

    return successResponse({ webhooks: data ?? [] });
}
