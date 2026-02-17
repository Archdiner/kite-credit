// ---------------------------------------------------------------------------
// Financial scoring and attestation tests
// ---------------------------------------------------------------------------

import { scoreFinancial, generateMockProof } from "../reclaim";
import { generateAttestation, verifyAttestationFormat } from "../attestation";
import type { FinancialData, KiteScore } from "@/types";

describe("scoreFinancial", () => {
    it("scores based on balance bracket", () => {
        const low = scoreFinancial(generateMockProof({ balance: 500 }));
        const mid = scoreFinancial(generateMockProof({ balance: 15000 }));
        const high = scoreFinancial(generateMockProof({ balance: 150000 }));

        expect(low.score).toBeLessThan(mid.score);
        expect(mid.score).toBeLessThan(high.score);
    });

    it("rewards income consistency", () => {
        const consistent = scoreFinancial(generateMockProof({ incomeConsistent: true }));
        const inconsistent = scoreFinancial(generateMockProof({ incomeConsistent: false }));

        expect(consistent.breakdown.incomeConsistency).toBeGreaterThan(
            inconsistent.breakdown.incomeConsistency
        );
    });

    it("gives verification bonus", () => {
        const verified: FinancialData = {
            verified: true,
            proofHash: "zk_abc123",
            balanceBracket: "5k-25k",
            incomeConsistency: true,
            provider: "chase",
        };
        const result = scoreFinancial(verified);
        expect(result.breakdown.verificationBonus).toBe(50);
    });

    it("never exceeds 300", () => {
        const maxed: FinancialData = {
            verified: true,
            proofHash: "zk_real",
            balanceBracket: "100k+",
            incomeConsistency: true,
            provider: "chase",
        };
        expect(scoreFinancial(maxed).score).toBeLessThanOrEqual(300);
    });
});

describe("generateMockProof", () => {
    it("generates valid financial data", () => {
        const mock = generateMockProof();
        expect(mock.verified).toBe(true);
        expect(mock.proofHash).toContain("mock_");
        expect(mock.balanceBracket).toBeTruthy();
    });
});

describe("attestation", () => {
    const mockScore: KiteScore = {
        total: 500,
        tier: "Steady",
        breakdown: {
            onChain: { score: 200, breakdown: { walletAge: 50, deFiActivity: 80, repaymentHistory: 50, staking: 20 } },
            github: { score: 150, breakdown: { accountAge: 30, repoPortfolio: 40, commitConsistency: 50, communityTrust: 30 } },
            financial: { score: 150, breakdown: { balanceHealth: 80, incomeConsistency: 50, verificationBonus: 20 } },
        },
        explanation: "Test explanation",
        timestamp: new Date().toISOString(),
    };

    it("generates a valid attestation", () => {
        const attestation = generateAttestation(mockScore);
        expect(attestation.kite_score).toBe(500);
        expect(attestation.tier).toBe("Steady");
        expect(attestation.verified_attributes).toContain("solana_active");
        expect(attestation.verified_attributes).toContain("github_linked");
        expect(attestation.verified_attributes).toContain("bank_verified");
        expect(attestation.proof).toMatch(/^0x/);
        expect(attestation.version).toBe("1.0");
    });

    it("validates attestation format", () => {
        const attestation = generateAttestation(mockScore);
        expect(verifyAttestationFormat(attestation)).toBe(true);
        expect(verifyAttestationFormat(null)).toBe(false);
        expect(verifyAttestationFormat({})).toBe(false);
    });
});
