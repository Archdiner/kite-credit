// ---------------------------------------------------------------------------
// Tests for Kite Score Calculation (v3 - 5 Factor Model)
// ---------------------------------------------------------------------------

import { assembleKiteScore, getTier } from "../scoring";
import type { OnChainScore, FinancialScore, GitHubScore } from "@/types";

describe("Kite Scoring Engine v3", () => {
    // Mock Data
    const mockOnChain: OnChainScore = {
        score: 500, // Max on-chain
        breakdown: {
            walletAge: 125,
            deFiActivity: 190,
            repaymentHistory: 125,
            staking: 60,
        },
    };

    const mockFinancial: FinancialScore = {
        score: 500, // Max financial
        breakdown: {
            balanceHealth: 250,
            incomeConsistency: 165,
            verificationBonus: 85,
        },
    };

    const mockGitHub: GitHubScore = {
        score: 300, // Max GitHub
        breakdown: {
            accountAge: 50,
            repoPortfolio: 75,
            commitConsistency: 100,
            communityTrust: 75,
        },
    };

    describe("getTier", () => {
        it("classifies scores correctly", () => {
            expect(getTier(850)).toBe("Elite");
            expect(getTier(750)).toBe("Strong");
            expect(getTier(650)).toBe("Steady");
            expect(getTier(500)).toBe("Building");
            expect(getTier(0)).toBe("Building");
        });
    });

    describe("assembleKiteScore", () => {
        it("calculates a perfect score correctly", () => {
            const result = assembleKiteScore(
                {
                    onChain: mockOnChain,
                    financial: mockFinancial,
                    github: mockGitHub,
                },
                "Test explanation"
            );

            // 5 Factors:
            // Payment History: 175 (on-chain) + 175 (bank) = 350
            // Utilization: 150 (on-chain staking) + 150 (bank balance) = 300
            // Credit Age: 150 (wallet age) = 150
            // Credit Mix: 100 (DeFi activity) = 100
            // New Credit: 100 (verification bonus) = 100
            // Total Core = 1000
            // + GitHub Bonus = 50
            // Capped at 1000

            expect(result.total).toBe(1000);
            expect(result.tier).toBe("Elite");
            expect(result.breakdown.fiveFactor.paymentHistory.score).toBe(350);
            expect(result.githubBonus).toBe(50);
        });

        it("calculates score without financial data", () => {
            const result = assembleKiteScore(
                {
                    onChain: mockOnChain,
                    financial: null,
                    github: null,
                },
                "Test explanation"
            );

            // Payment History: 175 (on-chain) + 0 = 175
            // Utilization: 150 (on-chain staking) + 0 = 150
            // Credit Age: 150 (wallet age) = 150
            // Credit Mix: 100 (DeFi activity) = 100
            // New Credit: 50 (baseline) = 50
            // Total = 625

            expect(result.total).toBe(625);
            expect(result.tier).toBe("Steady");
        });

        it("calculates score with only empty wallet", () => {
            const emptyOnChain: OnChainScore = {
                score: 0,
                breakdown: { walletAge: 0, deFiActivity: 0, repaymentHistory: 0, staking: 0 }
            };

            const result = assembleKiteScore(
                {
                    onChain: emptyOnChain,
                    financial: null,
                    github: null,
                },
                "Test explanation"
            );

            // Payment History: 0
            // Utilization: 0
            // Credit Age: 0
            // Credit Mix: 0
            // New Credit: 50 (baseline)
            // Total = 50

            expect(result.total).toBe(50);
            expect(result.tier).toBe("Building");
        });
    });
});
