// ---------------------------------------------------------------------------
// Reclaim Protocol -- ZK Financial Verification
// ---------------------------------------------------------------------------
// Integrates the Reclaim Protocol SDK to verify bank account data
// using zero-knowledge proofs. No raw financial data is stored --
// only the proof hash and derived balance bracket.
// ---------------------------------------------------------------------------

import type { FinancialData, FinancialScore } from "@/types";
import { getAppUrl } from "@/lib/env";

// ---------------------------------------------------------------------------
// Reclaim verification request
// ---------------------------------------------------------------------------

interface ReclaimVerificationRequest {
    providerId: string;    // Reclaim provider ID
    callbackUrl: string;   // Where Reclaim posts the proof
}

interface ReclaimProof {
    claimData: {
        provider: string;
        parameters: string;
        context: string;
    };
    signatures: string[];
    extractedValues: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Balance bracket derivation
// ---------------------------------------------------------------------------

function deriveBalanceBracket(balance: number): string {
    if (balance < 1000) return "under-1k";
    if (balance < 5000) return "1k-5k";
    if (balance < 25000) return "5k-25k";
    if (balance < 100000) return "25k-100k";
    return "100k+";
}

// ---------------------------------------------------------------------------
// Generate Reclaim verification URL
// ---------------------------------------------------------------------------

export async function initiateVerification(
    appId: string,
    appSecret: string,
): Promise<{ requestUrl: string; statusUrl: string }> {
    try {
        // For the hackathon prototype, we use the Reclaim HTTP API
        // to generate a verification request URL
        const TIMEOUT_MS = 10_000; // 10 second timeout for Reclaim API
        const response = await fetch(
            "https://api.reclaimprotocol.org/api/sdk/start-session",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    appId,
                    appSecret,
                    providerId: "banking-balance",
                    callbackUrl: `${getAppUrl()}/api/reclaim/callback`,
                }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            }
        );

        if (!response.ok) {
            throw new Error(`Reclaim API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            requestUrl: data.requestUrl || data.url,
            statusUrl: data.statusUrl || "",
        };
    } catch (err) {
        console.error("[reclaim] Session creation failed:", err);
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Verify Reclaim proof (mock/structure check since SDK is missing)
// ---------------------------------------------------------------------------

export function verifyProof(proof: ReclaimProof): boolean {
    if (!proof) return false;

    // 1. Validate structure
    if (!proof.claimData || !proof.signatures || !proof.extractedValues) {
        return false;
    }

    // 2. Validate signatures (must have at least one)
    if (!Array.isArray(proof.signatures) || proof.signatures.length === 0) {
        return false;
    }

    // 3. Validate claimData schema
    const { provider, parameters, context } = proof.claimData;
    if (!provider || !parameters || !context) {
        return false;
    }

    // Note: in a real production env with @reclaimprotocol/js-sdk, we would call:
    // return Reclaim.verifySignedProof(proof);

    return true;
}

// ---------------------------------------------------------------------------
// Process Reclaim proof callback
// ---------------------------------------------------------------------------

export function processProof(proof: ReclaimProof): FinancialData {
    const extractedBalance = proof.extractedValues?.balance;
    // Fix: Handle NaN result from parseFloat
    let balance = extractedBalance ? parseFloat(extractedBalance) : 0;
    if (isNaN(balance)) {
        balance = 0;
    }

    return {
        verified: true,
        proofHash: generateProofHash(proof),
        balanceBracket: deriveBalanceBracket(balance),
        incomeConsistency: !!proof.extractedValues?.income_consistent,
        provider: proof.claimData?.provider || "bank",
    };
}

// ---------------------------------------------------------------------------
// Mock proof for development and fallback
// ---------------------------------------------------------------------------
// Since Chase Bank isn't a pre-built Reclaim provider, we generate
// mock proofs during development. In production, a custom provider
// would be configured for chase.com.
// ---------------------------------------------------------------------------

export function generateMockProof(options?: {
    balance?: number;
    incomeConsistent?: boolean;
    provider?: string;
}): FinancialData {
    const balance = options?.balance ?? 15000;

    return {
        verified: true,
        proofHash: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        balanceBracket: deriveBalanceBracket(balance),
        incomeConsistency: options?.incomeConsistent ?? true,
        provider: options?.provider ?? "chase_mock",
    };
}

// ---------------------------------------------------------------------------
// Proof hash generation
// ---------------------------------------------------------------------------

// Simple non-cryptographic reference ID for prototype use.
// This is NOT a zero-knowledge or cryptographic proof hash — it is a
// quick deterministic identifier derived from proof signatures for
// deduplication and traceability only.
function generateProofHash(proof: ReclaimProof): string {
    const sigStr = proof.signatures?.join("") || "";
    let hash = 0;
    for (let i = 0; i < sigStr.length; i++) {
        const char = sigStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return `ref_${Math.abs(hash).toString(16)}`;
}

// ---------------------------------------------------------------------------
// Financial scoring (0-500)
// ---------------------------------------------------------------------------

export function scoreFinancial(data: FinancialData): FinancialScore {
    // Balance health: 0-250
    const balanceScores: Record<string, number> = {
        "under-1k": 35,
        "1k-5k": 85,
        "5k-25k": 150,
        "25k-100k": 215,
        "100k+": 250,
    };
    const balanceHealth = balanceScores[data.balanceBracket] ?? 35;

    // Income consistency: 0-165
    const incomeConsistency = data.incomeConsistency ? 165 : 50;

    // Verification bonus: 0-85
    // You get points just for verifying, more if it's a real proof
    const isRealProof = !data.proofHash.startsWith("mock_");
    const verificationBonus = data.verified ? (isRealProof ? 85 : 60) : 0;

    const total = balanceHealth + incomeConsistency + verificationBonus;

    return {
        score: Math.min(500, total),
        breakdown: {
            balanceHealth,
            incomeConsistency,
            verificationBonus,
        },
        verified: data.verified,
    };
}
