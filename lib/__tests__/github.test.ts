// ---------------------------------------------------------------------------
// GitHub scoring tests
// ---------------------------------------------------------------------------

import { scoreGitHub } from "../github";
import type { GitHubData } from "@/types";

function makeData(overrides: Partial<GitHubData> = {}): GitHubData {
    return {
        username: "testuser",
        accountAgeDays: 0,
        publicRepos: 0,
        totalStars: 0,
        followers: 0,
        recentCommitCount: 0,
        longestRepoAgeDays: 0,
        recentActiveWeeks: 0,
        ...overrides,
    };
}

describe("scoreGitHub", () => {
    it("returns 0 for a brand-new empty profile", () => {
        const result = scoreGitHub(makeData());
        expect(result.score).toBe(0);
        expect(result.breakdown.accountAge).toBe(0);
        expect(result.breakdown.repoPortfolio).toBe(0);
        expect(result.breakdown.commitConsistency).toBe(0);
        expect(result.breakdown.communityTrust).toBe(0);
    });

    it("scores account age progressively", () => {
        const day90 = scoreGitHub(makeData({ accountAgeDays: 90 }));
        const day365 = scoreGitHub(makeData({ accountAgeDays: 365 }));
        const day2000 = scoreGitHub(makeData({ accountAgeDays: 2000 }));

        expect(day90.breakdown.accountAge).toBe(15);
        expect(day365.breakdown.accountAge).toBe(30);
        expect(day2000.breakdown.accountAge).toBe(50);
    });

    it("caps repo portfolio at 75", () => {
        const result = scoreGitHub(
            makeData({
                publicRepos: 50,
                totalStars: 5000,
                longestRepoAgeDays: 3000,
            })
        );
        expect(result.breakdown.repoPortfolio).toBeLessThanOrEqual(75);
    });

    it("values commit consistency", () => {
        const inactive = scoreGitHub(makeData({ recentCommitCount: 0, recentActiveWeeks: 0 }));
        const active = scoreGitHub(makeData({ recentCommitCount: 200, recentActiveWeeks: 20 }));

        expect(active.breakdown.commitConsistency).toBeGreaterThan(
            inactive.breakdown.commitConsistency
        );
    });

    it("never exceeds 300 total", () => {
        const maxed = scoreGitHub(
            makeData({
                accountAgeDays: 5000,
                publicRepos: 100,
                totalStars: 10000,
                followers: 5000,
                recentCommitCount: 5000,
                longestRepoAgeDays: 5000,
                recentActiveWeeks: 52,
            })
        );
        expect(maxed.score).toBeLessThanOrEqual(300);
    });

    it("produces a score object with all required fields", () => {
        const result = scoreGitHub(makeData({ accountAgeDays: 200 }));
        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("breakdown");
        expect(result.breakdown).toHaveProperty("accountAge");
        expect(result.breakdown).toHaveProperty("repoPortfolio");
        expect(result.breakdown).toHaveProperty("commitConsistency");
        expect(result.breakdown).toHaveProperty("communityTrust");
    });
});
