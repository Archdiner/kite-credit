// ---------------------------------------------------------------------------
// Financial scoring and attestation tests (rescaled to 0-500)
// ---------------------------------------------------------------------------

import { scoreFinancial, generateMockProof } from "../reclaim";
import { generateAttestation, isValidAttestationShape } from "../attestation";
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
        expect(result.breakdown.verificationBonus).toBe(85);
    });

    it("never exceeds 500", () => {
        const maxed: FinancialData = {
            verified: true,
            proofHash: "zk_real",
            balanceBracket: "100k+",
            incomeConsistency: true,
            provider: "chase",
        };
        expect(scoreFinancial(maxed).score).toBeLessThanOrEqual(500);
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
        total: 750,
        tier: "Strong",
        breakdown: {
            onChain: { score: 200, breakdown: { walletAge: 50, deFiActivity: 75, repaymentHistory: 50, staking: 25 } },
            github: { score: 100, breakdown: { accountAge: 20, repoPortfolio: 30, commitConsistency: 30, communityTrust: 20 } },
            financial: { score: 250, breakdown: { balanceHealth: 100, incomeConsistency: 100, verificationBonus: 50 }, verified: true },
            fiveFactor: {
                paymentHistory: { score: 250, details: { onChainRepayments: 10, bankBillPay: 10 } },
                utilization: { score: 200, details: { creditUtilization: 10, collateralHealth: 10, balanceRatio: 10 } },
                creditAge: { score: 100, details: { walletAge: 10, accountAge: 10 } },
                creditMix: { score: 100, details: { protocolDiversity: 10, accountDiversity: 10 } },
                newCredit: { score: 100, details: { recentInquiries: 10, recentOpenings: 10 } }
            }
        },
        githubBonus: 0, // Added missing field
        explanation: "Good credit score",
        timestamp: new Date().toISOString()
    };

    it("generates a valid attestation", () => {
        const attestation = generateAttestation(mockScore);
        expect(attestation.kite_score).toBe(750);
        expect(attestation.tier).toBe("Strong");
        expect(attestation.verified_attributes).toContain("solana_active");
        expect(attestation.verified_attributes).toContain("bank_verified");
        expect(attestation.verified_attributes).toContain("github_linked");
        expect(attestation.proof).toMatch(/^0x/);
        expect(attestation.version).toBe("1.0");
    });

    it("validates attestation format", () => {
        const attestation = generateAttestation(mockScore);
        expect(isValidAttestationShape(attestation)).toBe(true);
        expect(isValidAttestationShape(null)).toBe(false);
        expect(isValidAttestationShape({})).toBe(false);
    });
});
