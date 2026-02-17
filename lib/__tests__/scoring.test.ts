// ---------------------------------------------------------------------------
// Scoring engine tests (v2 -- 50/50 on-chain + financial)
// ---------------------------------------------------------------------------

import { calculateKiteScore, getTier, getConnectedSources } from "../scoring";
import type { ScoreBreakdown, OnChainScore, GitHubScore, FinancialScore } from "@/types";

const onChainScore: OnChainScore = {
    score: 300,
    breakdown: { walletAge: 100, deFiActivity: 120, repaymentHistory: 60, staking: 20 },
};

const githubScore: GitHubScore = {
    score: 180,
    breakdown: { accountAge: 40, repoPortfolio: 50, commitConsistency: 60, communityTrust: 30 },
};

const financialScore: FinancialScore = {
    score: 350,
    breakdown: { balanceHealth: 150, incomeConsistency: 130, verificationBonus: 70 },
};

describe("calculateKiteScore", () => {
    it("sums core scores (on-chain + financial only)", () => {
        const result = calculateKiteScore({
            onChain: onChainScore,
            github: null,
            financial: financialScore,
        });
        expect(result.total).toBe(650); // 300 + 350
    });

    it("adds GitHub as bonus scaled from 0-300 to 0-100", () => {
        const withGithub = calculateKiteScore({
            onChain: onChainScore,
            github: githubScore,
            financial: financialScore,
        });
        // Core: 300 + 350 = 650. GitHub bonus: floor(180/300 * 100) = 60
        expect(withGithub.total).toBe(710);
    });

    it("handles null sub-scores", () => {
        const result = calculateKiteScore({
            onChain: onChainScore,
            github: null,
            financial: null,
        });
        expect(result.total).toBe(300);
    });

    it("caps at 1000", () => {
        const maxOnChain: OnChainScore = {
            score: 500,
            breakdown: { walletAge: 125, deFiActivity: 190, repaymentHistory: 125, staking: 60 },
        };
        const maxFinancial: FinancialScore = {
            score: 500,
            breakdown: { balanceHealth: 250, incomeConsistency: 165, verificationBonus: 85 },
        };
        const maxGithub: GitHubScore = {
            score: 300,
            breakdown: { accountAge: 50, repoPortfolio: 75, commitConsistency: 100, communityTrust: 75 },
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
