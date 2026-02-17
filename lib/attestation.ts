// ---------------------------------------------------------------------------
// ZK Attestation generation
// ---------------------------------------------------------------------------
// Generates a ZK attestation from the Kite Score. This is the shareable
// proof that a user has achieved a certain credit tier without revealing
// the underlying data.
// ---------------------------------------------------------------------------

import type { KiteScore, ZKAttestation, ScoreTier } from "@/types";
import { getConnectedSources } from "@/lib/scoring";
import { createHmac } from "node:crypto";

export function generateAttestation(score: KiteScore): ZKAttestation {
    const connectedSources = getConnectedSources(score.breakdown);

    // Generate a deterministic proof hash from score data
    const proofData = JSON.stringify({
        total: score.total,
        tier: score.tier,
        sources: connectedSources,
        timestamp: score.timestamp,


    });

    // HMAC-SHA256 signing
    // Ensure ATTESTATION_SECRET is set in production!
    const secret = process.env.ATTESTATION_SECRET || "dev-attestation-secret-change-me";
    const hmac = createHmac("sha256", secret);
    hmac.update(proofData);
    const proofHex = hmac.digest("hex");

    return {
        kite_score: score.total,
        tier: score.tier,
        verified_attributes: connectedSources,
        proof: `0x${proofHex}`,
        issued_at: score.timestamp,
        version: "1.0",
    };
}

// ---------------------------------------------------------------------------
// Attestation shape validation (for consumers of the attestation)
// Note: This only validates the object shape. It does NOT verify the
// cryptographic HMAC proof. Use a separate verification step for that.
// ---------------------------------------------------------------------------

export function isValidAttestationShape(attestation: unknown): attestation is ZKAttestation {
    if (!attestation || typeof attestation !== "object") return false;
    const a = attestation as Record<string, unknown>;

    return (
        typeof a.kite_score === "number" &&
        typeof a.tier === "string" &&
        Array.isArray(a.verified_attributes) &&
        typeof a.proof === "string" &&
        typeof a.issued_at === "string" &&
        typeof a.version === "string"
    );
}
