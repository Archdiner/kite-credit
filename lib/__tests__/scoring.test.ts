import { assembleKiteScore, getTier } from "../scoring";
import type { OnChainScore, FinancialScore, GitHubScore } from "@/types";

describe("Kite Scoring Engine v3", () => {
    const mockOnChain: OnChainScore = {
        score: 500,
        breakdown: {
            walletAge: 125,
            deFiActivity: 165,
            repaymentHistory: 125,
            staking: 60,
            stablecoinCapital: 25,
        },
    };

    const mockFinancial: FinancialScore = {
        score: 500,
        breakdown: {
            balanceHealth: 250,
            incomeConsistency: 165,
            verificationBonus: 85,
        },
        verified: true,
    };

    const mockGitHub: GitHubScore = {
        score: 300,
        breakdown: {
            accountAge: 40,
            repoPortfolio: 60,
            commitConsistency: 70,
            communityTrust: 50,
            codeQuality: 80,
        },
    };

    describe("assembleKiteScore", () => {
        it("caps score at 1000 with perfect inputs", () => {
            const result = assembleKiteScore(
                { onChain: mockOnChain, financial: mockFinancial, github: mockGitHub },
                "Test explanation"
            );
            expect(result.total).toBeLessThanOrEqual(1000);
            expect(result.tier).toBe("Elite");
            expect(result.githubBonus).toBe(50);
        });

        it("produces valid score without financial data", () => {
            const result = assembleKiteScore(
                { onChain: mockOnChain, financial: null, github: null },
                "On-chain only"
            );
            expect(result.total).toBeGreaterThan(0);
            expect(result.total).toBeLessThanOrEqual(1000);
            expect(result.weights?.onChain).toBeGreaterThan(0.9);
            expect(result.weights?.financial).toBeLessThan(0.1);
        });

        it("applies trust dampener for fresh empty wallets", () => {
            const emptyOnChain: OnChainScore = {
                score: 0,
                breakdown: { walletAge: 0, deFiActivity: 0, repaymentHistory: 0, staking: 0, stablecoinCapital: 0 },
            };
            const result = assembleKiteScore(
                { onChain: emptyOnChain, financial: null, github: null },
                "New wallet"
            );
            expect(result.total).toBeLessThan(100);
            expect(result.tier).toBe("Building");
        });

        it("gives synergy boost when both on-chain and financial are strong", () => {
            const scoreWithBoth = assembleKiteScore(
                { onChain: mockOnChain, financial: mockFinancial, github: null },
                "Both sources"
            );
            const onChainOnly = assembleKiteScore(
                { onChain: mockOnChain, financial: null, github: null },
                "On-chain only"
            );
            expect(scoreWithBoth.total).toBeGreaterThan(onChainOnly.total);
        });

        it("applies multi-wallet trust boost", () => {
            const withoutSecondary = assembleKiteScore(
                { onChain: mockOnChain, financial: null, github: null, secondaryWalletCount: 0 },
                "Single wallet"
            );
            const withSecondary = assembleKiteScore(
                { onChain: mockOnChain, financial: null, github: null, secondaryWalletCount: 2 },
                "Multi wallet"
            );
            expect(withSecondary.total).toBeGreaterThanOrEqual(withoutSecondary.total);
        });

        it("includes all five factors in breakdown", () => {
            const result = assembleKiteScore(
                { onChain: mockOnChain, financial: mockFinancial, github: mockGitHub },
                "Full"
            );
            const { fiveFactor } = result.breakdown;
            expect(fiveFactor.paymentHistory.score).toBeGreaterThanOrEqual(0);
            expect(fiveFactor.utilization.score).toBeGreaterThanOrEqual(0);
            expect(fiveFactor.creditAge.score).toBeGreaterThanOrEqual(0);
            expect(fiveFactor.creditMix.score).toBeGreaterThanOrEqual(0);
            expect(fiveFactor.newCredit.score).toBeGreaterThanOrEqual(0);
        });

        it("returns valid timestamp", () => {
            const result = assembleKiteScore(
                { onChain: mockOnChain, financial: null, github: null },
                "Test"
            );
            expect(() => new Date(result.timestamp)).not.toThrow();
        });
    });
});
