// ---------------------------------------------------------------------------
// GET /api/lender/score/:address/detail
// ---------------------------------------------------------------------------
// Returns the full 5-factor FICO breakdown for a wallet address.
// Requires a valid lender API key (Bearer kite_...).
//
// Response shape:
//   {
//     found: true,
//     score: 742,
//     tier: "Strong",
//     valid: true,
//     expired: false,
//     issued_at: "...",
//     expires_at: "...",
//     verified_attributes: [...],
//     five_factor: {
//       payment_history: { score: 280, max: 350 },
//       utilization:     { score: 210, max: 300 },
//       credit_age:      { score: 112, max: 150 },
//       credit_mix:      { score: 75,  max: 100 },
//       new_credit:      { score: 65,  max: 100 }
//     },
//     sources: {
//       on_chain:  { chains: ["solana", "ethereum"], score: 412 },
//       financial: { connected: false, score: 0 },
//       github:    { connected: true,  bonus: 42 }
//     }
//   }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase";
import { authenticateApiKey, checkLenderRateLimit } from "@/lib/api-key-auth";
import type { SignedAttestation, FiveFactorBreakdown, ScoreBreakdown } from "@/types";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function verifyAttestation(
    attestation: SignedAttestation,
    total: number,
    tier: string,
    sources: string[]
): boolean {
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

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    const lender = await authenticateApiKey(req);
    if (!lender) {
        return NextResponse.json({ error: "Valid API key required" }, { status: 401 });
    }

    const { success } = await checkLenderRateLimit(lender.id, "score-detail", lender.rate_limit);
    if (!success) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { address } = await params;

    const isEth = ETH_ADDRESS_REGEX.test(address);
    const isSolana = SOLANA_ADDRESS_REGEX.test(address);

    if (!isEth && !isSolana) {
        return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
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
        return NextResponse.json({ found: false }, { status: 404 });
    }

    // Get latest score with full breakdown
    const { data: scoreRow } = await supabase
        .from("user_scores")
        .select("total_score, tier, breakdown, sources, attestation, calculated_at")
        .eq("user_id", connection.user_id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

    if (!scoreRow || !scoreRow.attestation) {
        return NextResponse.json({ found: false }, { status: 404 });
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

    // Derive 5-factor breakdown from stored JSONB
    const breakdown = scoreRow.breakdown as ScoreBreakdown & {
        fiveFactor?: FiveFactorBreakdown;
    };
    const ff = breakdown?.fiveFactor;

    const fiveFactor = ff
        ? {
            payment_history: { score: ff.paymentHistory.score, max: 350 },
            utilization:     { score: ff.utilization.score,    max: 300 },
            credit_age:      { score: ff.creditAge.score,      max: 150 },
            credit_mix:      { score: ff.creditMix.score,      max: 100 },
            new_credit:      { score: ff.newCredit.score,      max: 100 },
          }
        : null;

    // Derive sources summary
    const sources = scoreRow.sources as string[] ?? [];
    const hasEthereum = sources.includes("ethereum_active");
    const hasSolana = sources.includes("solana_active");
    const chains: string[] = [];
    if (hasSolana) chains.push("solana");
    if (hasEthereum) chains.push("ethereum");

    const onChainScore = breakdown?.onChain?.score ?? 0;
    const financialConnected = !!(breakdown?.financial?.verified);
    const financialScore = breakdown?.financial?.score ?? 0;
    const githubConnected = !!(breakdown?.github);
    const githubBonus = githubConnected && breakdown?.github
        ? Math.min(50, Math.floor(breakdown.github.score / 6))
        : 0;

    return NextResponse.json({
        found: true,
        score: scoreRow.total_score,
        tier: scoreRow.tier,
        valid: valid && !expired,
        expired,
        issued_at: attestation.issued_at ?? null,
        expires_at: attestation.expires_at ?? null,
        verified_attributes: attestation.verified_attributes,
        five_factor: fiveFactor,
        sources: {
            on_chain:  { chains, score: onChainScore },
            financial: { connected: financialConnected, score: financialScore },
            github:    { connected: githubConnected, bonus: githubBonus },
        },
    });
}
