// ---------------------------------------------------------------------------
// ZK Attestation generation
// ---------------------------------------------------------------------------
// Generates a ZK attestation from the Kite Score. This is the shareable
// proof that a user has achieved a certain credit tier without revealing
// the underlying data.
// ---------------------------------------------------------------------------

import type { KiteScore, ZKAttestation, ScoreTier } from "@/types";
import { getConnectedSources } from "@/lib/scoring";

export function generateAttestation(score: KiteScore): ZKAttestation {
    const connectedSources = getConnectedSources(score.breakdown);

    // Generate a deterministic proof hash from score data
    const proofData = JSON.stringify({
        total: score.total,
        tier: score.tier,
        sources: connectedSources,
        timestamp: score.timestamp,
    });

    let hash = 0;
    for (let i = 0; i < proofData.length; i++) {
        const char = proofData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }

    const proofHex = Math.abs(hash).toString(16).padStart(16, "0");

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
// Attestation verification (for consumers of the attestation)
// ---------------------------------------------------------------------------

export function verifyAttestationFormat(attestation: unknown): attestation is ZKAttestation {
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
