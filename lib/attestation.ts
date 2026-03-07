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
import { privateKeyToAccount } from "viem/accounts";
import { hashMessage } from "viem";

function getOracleAccount() {
    // We expect a hex private key starting with 0x
    const secret = process.env.ATTESTATION_PRIVATE_KEY || process.env.ATTESTATION_SECRET;
    const defaultSecret = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil account #0

    if (!secret || secret === defaultSecret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "[attestation] ATTESTATION_PRIVATE_KEY is missing. " +
                "All attestations would be forgeable. Set a 32-byte hex 0x-prefixed EVM private key."
            );
        }
    }

    const keyToUse = secret && secret.startsWith("0x") ? secret : defaultSecret;
    return privateKeyToAccount(keyToUse as `0x${string}`);
}

export async function generateAttestation(score: KiteScore, walletAddress: string): Promise<SignedAttestation> {
    const connectedSources = getConnectedSources(score.breakdown);
    const issuedAt = score.timestamp;
    const expiresAt = new Date(new Date(issuedAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
        wallet_address: walletAddress,
        kite_score: score.total,
        tier: score.tier,
        verified_attributes: connectedSources,
        issued_at: issuedAt,
        expires_at: expiresAt,
        version: "2.0",
    };

    const payloadString = JSON.stringify(payload);

    // Sign the message with the Kite Oracle private key using secp256k1
    const oracle = getOracleAccount();
    const signature = await oracle.signMessage({ message: payloadString });

    return {
        ...payload,
        proof: signature,
        signer_address: oracle.address,
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
        typeof a.wallet_address === "string" &&
        typeof a.kite_score === "number" &&
        typeof a.tier === "string" &&
        Array.isArray(a.verified_attributes) &&
        typeof a.proof === "string" &&
        typeof a.signer_address === "string" &&
        typeof a.issued_at === "string" &&
        ["1.0", "2.0"].includes(a.version as string)
    );
}
