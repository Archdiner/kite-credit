// ---------------------------------------------------------------------------
// Score attestation generation
// ---------------------------------------------------------------------------
// Generates a signed attestation from the Kite Score. This is the portable
// credential a user can share with lenders, landlords, or DeFi protocols
// to prove their tier without revealing the underlying data.
//
// Implementation note:
//   The proof field is an HMAC-SHA256 signature over deterministic score data.
//   "ZK Attestation" is the product-facing name used in the UI — actual
//   zero-knowledge proofs live in lib/reclaim.ts (bank data verification).
//   Attestation consumers should verify the HMAC server-side using the shared
//   ATTESTATION_SECRET before trusting the payload.
// ---------------------------------------------------------------------------

import type { KiteScore, SignedAttestation } from "@/types";
import { getConnectedSources } from "@/lib/scoring";
import { createHmac } from "node:crypto";

function getAttestationSecret(): string {
    const secret = process.env.ATTESTATION_SECRET;
    const defaultSecret = "dev-attestation-secret-change-me";

    if (!secret || secret === defaultSecret) {
        if (process.env.NODE_ENV === "production") {
            // Throwing here prevents the server from starting with a forged-proof risk.
            throw new Error(
                "[attestation] ATTESTATION_SECRET is missing or set to the default value. " +
                "All attestations would be forgeable. Set a random 32-byte hex value in your environment."
            );
        }
        if (process.env.NODE_ENV !== "test") {
            console.warn(
                "[attestation] WARNING: Using default ATTESTATION_SECRET. " +
                "Run `openssl rand -hex 32` and set ATTESTATION_SECRET before deploying to production."
            );
        }
        return defaultSecret;
    }

    return secret;
}

export function generateAttestation(score: KiteScore): SignedAttestation {
    const connectedSources = getConnectedSources(score.breakdown);

    const proofData = JSON.stringify({
        total: score.total,
        tier: score.tier,
        sources: connectedSources,
        timestamp: score.timestamp,
    });

    const secret = getAttestationSecret();
    const hmac = createHmac("sha256", secret);
    hmac.update(proofData);
    const proofHex = hmac.digest("hex");

    const issuedAt = score.timestamp;
    const expiresAt = new Date(new Date(issuedAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    return {
        kite_score: score.total,
        tier: score.tier,
        verified_attributes: connectedSources,
        proof: `0x${proofHex}`,
        issued_at: issuedAt,
        expires_at: expiresAt,
        version: "1.0",
    };
}

// ---------------------------------------------------------------------------
// Shape validation (for consumers of an attestation object)
// Does NOT verify the cryptographic HMAC — do that server-side.
// ---------------------------------------------------------------------------

export function isValidAttestationShape(attestation: unknown): attestation is SignedAttestation {
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
