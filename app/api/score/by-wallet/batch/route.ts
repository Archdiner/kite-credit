// ---------------------------------------------------------------------------
// POST /api/score/by-wallet/batch — Bulk wallet score lookup (API-key-only)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey, checkLenderRateLimit } from "@/lib/api-key-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import type { SignedAttestation } from "@/types";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_ADDRESSES = 50;

export async function POST(req: NextRequest) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return errorResponse("Valid API key required. Pass Authorization: Bearer kite_...", 401);
    }

    const { success } = await checkLenderRateLimit(lender.id, "batch", lender.rate_limit);
    if (!success) {
        return errorResponse("Rate limit exceeded", 429);
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return errorResponse("Invalid JSON body", 400);
    }

    const { addresses } = body as { addresses?: string[] };

    if (!Array.isArray(addresses) || addresses.length === 0) {
        return errorResponse("addresses must be a non-empty array", 400);
    }

    // Deduplicate and validate
    const unique = [...new Set(addresses)];
    if (unique.length > MAX_ADDRESSES) {
        return errorResponse(`Maximum ${MAX_ADDRESSES} addresses per request`, 400);
    }

    const invalid = unique.filter((a) => typeof a !== "string" || !SOLANA_ADDRESS_REGEX.test(a));
    if (invalid.length > 0) {
        return errorResponse(`Invalid Solana address(es): ${invalid.slice(0, 3).join(", ")}`, 400);
    }

    const supabase = createServerSupabaseClient();

    // Find all wallet connections for these addresses
    const { data: connections } = await supabase
        .from("user_connections")
        .select("user_id, provider_user_id")
        .eq("provider", "solana_wallet")
        .in("provider_user_id", unique);

    if (!connections || connections.length === 0) {
        return successResponse({
            results: unique.map((address) => ({ address, found: false })),
            lookup_count: unique.length,
        });
    }

    // Build address→userId map
    const addressToUser = new Map<string, string>();
    for (const c of connections) {
        addressToUser.set(c.provider_user_id, c.user_id);
    }

    const userIds = [...new Set(connections.map((c) => c.user_id))];

    // Fetch latest scores for all matched users using distinct on user_id
    // Supabase JS doesn't support DISTINCT ON, so we fetch recent scores and dedupe
    const { data: scores } = await supabase
        .from("user_scores")
        .select("user_id, total_score, tier, attestation, sources, calculated_at")
        .in("user_id", userIds)
        .order("calculated_at", { ascending: false });

    // Keep only the latest score per user
    const latestByUser = new Map<string, typeof scores extends (infer T)[] | null ? T : never>();
    if (scores) {
        for (const s of scores) {
            if (!latestByUser.has(s.user_id)) {
                latestByUser.set(s.user_id, s);
            }
        }
    }

    const results = unique.map((address) => {
        const userId = addressToUser.get(address);
        if (!userId) return { address, found: false as const };

        const scoreRow = latestByUser.get(userId);
        if (!scoreRow || !scoreRow.attestation) return { address, found: false as const };

        const attestation = scoreRow.attestation as SignedAttestation;
        const expired = attestation.expires_at
            ? new Date(attestation.expires_at) < new Date()
            : false;

        return {
            address,
            found: true as const,
            score: scoreRow.total_score,
            tier: scoreRow.tier,
            expired,
            issued_at: attestation.issued_at ?? null,
            expires_at: attestation.expires_at ?? null,
        };
    });

    return successResponse({ results, lookup_count: unique.length });
}
