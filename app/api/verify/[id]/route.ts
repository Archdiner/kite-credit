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
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

    const response = {
        valid,
        score: data.cryptoScore,
        tier: data.cryptoTier,
        verified_attributes: data.verifiedAttrs,
        issued_at: data.attestationDate ?? null,
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
