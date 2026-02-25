// ---------------------------------------------------------------------------
// GET /api/score/by-wallet/:address — wallet-first score lookup
// ---------------------------------------------------------------------------
// Lenders and DeFi protocols often know a borrower's wallet address but not
// their Kite share link. This endpoint returns the latest stored score for
// a given Solana wallet address, letting integrators query by identity rather
// than by share ID.
//
// Usage:
//   GET https://kitecredit.xyz/api/score/by-wallet/7xKXtg...
//
// Response (found, valid):
//   {
//     "found": true,
//     "valid": true,
//     "expired": false,
//     "score": 742,
//     "tier": "Strong",
//     "verified_attributes": ["solana_active", "github_linked"],
//     "issued_at": "2026-02-22T12:00:00.000Z",
//     "expires_at": "2026-05-23T12:00:00.000Z",
//     "age_hours": 2
//   }
//
// Response (not found):
//   { "found": false }
//
// Notes:
//   - Uses service role to join user_connections → user_scores across users.
//     All returned data is score output derived from public on-chain signals.
//   - HMAC proof is verified server-side before returning valid: true.
//   - Rate limited to 60 req/min per IP.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { authenticateApiKey, checkLenderRateLimit } from "@/lib/api-key-auth";
import type { SignedAttestation } from "@/types";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function verifyAttestation(attestation: SignedAttestation, total: number, tier: string, sources: string[]): boolean {
    try {
        const secret = process.env.ATTESTATION_SECRET || "dev-attestation-secret-change-me";
        const proofData = JSON.stringify({
            total,
            tier,
            sources,
            timestamp: attestation.issued_at,
        });
        const hmac = createHmac("sha256", secret);
        hmac.update(proofData);
        const expected = "0x" + hmac.digest("hex");
        return attestation.proof === expected;
    } catch {
        return false;
    }
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    // Dual-path auth: API key gets higher rate limit, anonymous uses IP-based
    const lender = await authenticateApiKey(req);
    let rateLimitResult;

    if (lender) {
        rateLimitResult = await checkLenderRateLimit(lender.id, "by-wallet", lender.rate_limit);
    } else {
        const ip = req.headers.get("x-forwarded-for") || "unknown";
        rateLimitResult = await checkRateLimit("by-wallet:" + ip, 60, 60);
    }

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": String(rateLimitResult.reset - Math.floor(Date.now() / 1000)) } }
        );
    }

    const { address } = await params;

    const isEth = ETH_ADDRESS_REGEX.test(address);
    const isSolana = SOLANA_ADDRESS_REGEX.test(address);

    if (!isEth && !isSolana) {
        return NextResponse.json(
            { error: "Invalid wallet address" },
            { status: 400, headers: CORS_HEADERS }
        );
    }

    const provider = isEth ? "ethereum_wallet" : "solana_wallet";
    const lookupAddress = isEth ? address.toLowerCase() : address;

    const supabase = createServerSupabaseClient();

    // Find the user associated with this wallet address
    const { data: connection } = await supabase
        .from("user_connections")
        .select("user_id")
        .eq("provider", provider)
        .eq("provider_user_id", lookupAddress)
        .single();

    if (!connection) {
        return NextResponse.json({ found: false }, { headers: CORS_HEADERS });
    }

    // Get their latest score
    const { data: scoreRow } = await supabase
        .from("user_scores")
        .select("total_score, tier, sources, attestation, calculated_at")
        .eq("user_id", connection.user_id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

    if (!scoreRow || !scoreRow.attestation) {
        return NextResponse.json({ found: false }, { headers: CORS_HEADERS });
    }

    const attestation = scoreRow.attestation as SignedAttestation;
    const valid = verifyAttestation(
        attestation,
        scoreRow.total_score,
        scoreRow.tier,
        scoreRow.sources ?? []
    );

    const expired = attestation.expires_at
        ? new Date(attestation.expires_at) < new Date()
        : false;

    const issuedAt = attestation.issued_at ? new Date(attestation.issued_at) : null;
    const ageHours = issuedAt
        ? Math.round((Date.now() - issuedAt.getTime()) / (1000 * 60 * 60))
        : null;

    const responseData: Record<string, unknown> = {
        found: true,
        valid: valid && !expired,
        expired,
        score: scoreRow.total_score,
        tier: scoreRow.tier,
        verified_attributes: attestation.verified_attributes,
        issued_at: attestation.issued_at ?? null,
        expires_at: attestation.expires_at ?? null,
        age_hours: ageHours,
    };

    if (lender) {
        responseData.authenticated = true;
        responseData.lender_key_prefix = lender.key_prefix;
    }

    return NextResponse.json(responseData, { headers: CORS_HEADERS });
}
