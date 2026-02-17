// ---------------------------------------------------------------------------
// Scoring engine tests
// ---------------------------------------------------------------------------

import { calculateKiteScore, getTier, getConnectedSources } from "../scoring";
import type { ScoreBreakdown, OnChainScore, GitHubScore, FinancialScore } from "@/types";

const onChainScore: OnChainScore = {
    score: 250,
    breakdown: { walletAge: 80, deFiActivity: 100, repaymentHistory: 50, staking: 20 },
};

const githubScore: GitHubScore = {
    score: 180,
    breakdown: { accountAge: 40, repoPortfolio: 50, commitConsistency: 60, communityTrust: 30 },
};

const financialScore: FinancialScore = {
    score: 200,
    breakdown: { balanceHealth: 100, incomeConsistency: 70, verificationBonus: 30 },
};

describe("calculateKiteScore", () => {
    it("sums sub-scores correctly", () => {
        const result = calculateKiteScore({
            onChain: onChainScore,
            github: githubScore,
            financial: financialScore,
        });
        expect(result.total).toBe(630);
    });

    it("handles null sub-scores", () => {
        const result = calculateKiteScore({
            onChain: onChainScore,
            github: null,
            financial: null,
        });
        expect(result.total).toBe(250);
    });

    it("caps at 1000", () => {
        const maxOnChain: OnChainScore = {
            score: 400,
            breakdown: { walletAge: 100, deFiActivity: 150, repaymentHistory: 100, staking: 50 },
        };
        const maxGithub: GitHubScore = {
            score: 300,
            breakdown: { accountAge: 50, repoPortfolio: 75, commitConsistency: 100, communityTrust: 75 },
        };
        const maxFinancial: FinancialScore = {
            score: 300,
            breakdown: { balanceHealth: 150, incomeConsistency: 100, verificationBonus: 50 },
        };
        const result = calculateKiteScore({
            onChain: maxOnChain,
            github: maxGithub,
            financial: maxFinancial,
        });
        expect(result.total).toBeLessThanOrEqual(1000);
        expect(result.tier).toBe("Elite");
    });
});

describe("getTier", () => {
    it("returns correct tiers", () => {
        expect(getTier(0)).toBe("Building");
        expect(getTier(300)).toBe("Building");
        expect(getTier(301)).toBe("Steady");
        expect(getTier(550)).toBe("Steady");
        expect(getTier(551)).toBe("Strong");
        expect(getTier(750)).toBe("Strong");
        expect(getTier(751)).toBe("Elite");
        expect(getTier(1000)).toBe("Elite");
    });
});

describe("getConnectedSources", () => {
    it("returns all connected sources", () => {
        const sources = getConnectedSources({
            onChain: onChainScore,
            github: githubScore,
            financial: financialScore,
        });
        expect(sources).toEqual(["solana_active", "github_linked", "bank_verified"]);
    });

    it("returns empty for no sources", () => {
        const sources = getConnectedSources({
            onChain: null,
            github: null,
            financial: null,
        });
        expect(sources).toEqual([]);
    });
});
