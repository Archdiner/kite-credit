// ---------------------------------------------------------------------------
// GET /api/verify/:id — Machine-readable score verification
// ---------------------------------------------------------------------------
// Returns a JSON object that DeFi protocols, lenders, and landlords can use
// to programmatically verify a Kite Score without trusting the score holder.
//
// Usage:
//   GET https://kitecredit.xyz/api/verify/abc123
//
// Response (valid):
//   {
//     "valid": true,
//     "score": 742,
//     "tier": "Strong",
//     "verified_attributes": ["solana_active", "github_linked"],
//     "issued_at": "2026-02-21T01:22:00.000Z",
//     "age_hours": 2
//   }
//
// Response (invalid / expired / not found):
//   { "valid": false, "error": "Score not found" }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getShareData } from "@/lib/share";
import { authenticateApiKey, checkLenderRateLimit } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ShareData } from "@/types";

function verifyProof(data: ShareData): boolean {
    try {
        const secret = process.env.ATTESTATION_SECRET || "dev-attestation-secret-change-me";
        const proofData = JSON.stringify({
            total: data.cryptoScore,
            tier: data.cryptoTier,
            sources: data.verifiedAttrs,
            timestamp: data.attestationDate,
        });
        const hmac = createHmac("sha256", secret);
        hmac.update(proofData);
        const expected = "0x" + hmac.digest("hex");
        return data.proof === expected;
    } catch {
        return false;
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Dual-path auth: API key gets higher rate limit
    const lender = await authenticateApiKey(req);
    let rateLimitResult;

    if (lender) {
        rateLimitResult = await checkLenderRateLimit(lender.id, "verify", lender.rate_limit);
    } else {
        const ip = req.headers.get("x-forwarded-for") || "unknown";
        rateLimitResult = await checkRateLimit("verify:" + ip, 60, 60);
    }

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": String(rateLimitResult.reset - Math.floor(Date.now() / 1000)) } }
        );
    }

    const { id } = await params;
    const data = await getShareData(id);

    if (!data) {
        return NextResponse.json(
            { valid: false, error: "Score not found" },
            { status: 404 }
        );
    }

    const valid = verifyProof(data);
    const issuedAt = data.attestationDate ? new Date(data.attestationDate) : null;
    const ageHours = issuedAt
        ? Math.round((Date.now() - issuedAt.getTime()) / (1000 * 60 * 60))
        : null;

    const expired = data.expiresAt ? new Date(data.expiresAt) < new Date() : false;

    const response = {
        valid: valid && !expired,
        expired,
        score: data.cryptoScore,
        tier: data.cryptoTier,
        verified_attributes: data.verifiedAttrs,
        issued_at: data.attestationDate ?? null,
        expires_at: data.expiresAt ?? null,
        age_hours: ageHours,
        ...(data.devScore !== null && {
            dev_score: data.devScore,
            dev_tier: data.devTier,
        }),
    };

    return NextResponse.json(response, {
        headers: {
            // Allow DeFi protocols to call this from client-side JS
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            // Cache for 60s — score data doesn't change, but allow quick re-checks
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
    });
}
