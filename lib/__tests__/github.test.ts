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
        languageDiversity: 0,
        ownerReputation: 0,
        originalityScore: 0,
        reposWithReadme: 0,
        reposWithCI: 0,
        totalPRsMerged: 0,
        totalIssuesClosed: 0,
        codeReviewCount: 0,
        avgRepoSize: 0,
        topRepoTestIndicator: 0,
        ...overrides,
    };
}

describe("scoreGitHub v2 — with code quality", () => {
    it("returns 0 for brand-new empty profile", () => {
        const result = scoreGitHub(makeData());
        expect(result.score).toBe(0);
        expect(result.breakdown.accountAge).toBe(0);
        expect(result.breakdown.codeQuality).toBe(0);
    });

    it("scores account age progressively", () => {
        const day30 = scoreGitHub(makeData({ accountAgeDays: 30 }));
        const day365 = scoreGitHub(makeData({ accountAgeDays: 365 }));
        const day2000 = scoreGitHub(makeData({ accountAgeDays: 2000 }));

        expect(day30.breakdown.accountAge).toBeGreaterThan(0);
        expect(day365.breakdown.accountAge).toBeGreaterThan(day30.breakdown.accountAge);
        expect(day2000.breakdown.accountAge).toBeGreaterThan(day365.breakdown.accountAge);
        expect(day2000.breakdown.accountAge).toBeLessThanOrEqual(40);
    });

    it("caps repo portfolio at 60", () => {
        const result = scoreGitHub(makeData({
            publicRepos: 50,
            totalStars: 5000,
            longestRepoAgeDays: 3000,
            languageDiversity: 10,
            originalityScore: 1.0,
        }));
        expect(result.breakdown.repoPortfolio).toBeLessThanOrEqual(60);
    });

    it("rewards commit consistency", () => {
        const inactive = scoreGitHub(makeData());
        const active = scoreGitHub(makeData({ recentCommitCount: 80, recentActiveWeeks: 15 }));
        expect(active.breakdown.commitConsistency).toBeGreaterThan(inactive.breakdown.commitConsistency);
    });

    it("caps commit consistency at 70", () => {
        const maxed = scoreGitHub(makeData({ recentCommitCount: 500, recentActiveWeeks: 52 }));
        expect(maxed.breakdown.commitConsistency).toBeLessThanOrEqual(70);
    });

    it("caps community trust at 50", () => {
        const maxed = scoreGitHub(makeData({ followers: 5000, ownerReputation: 1000 }));
        expect(maxed.breakdown.communityTrust).toBeLessThanOrEqual(50);
    });

    describe("codeQuality dimension", () => {
        it("rewards README presence", () => {
            const noReadme = scoreGitHub(makeData({ publicRepos: 10 }));
            const withReadme = scoreGitHub(makeData({ publicRepos: 10, reposWithReadme: 8 }));
            expect(withReadme.breakdown.codeQuality).toBeGreaterThan(noReadme.breakdown.codeQuality);
        });

        it("rewards CI/CD adoption", () => {
            const noCI = scoreGitHub(makeData({ publicRepos: 10 }));
            const withCI = scoreGitHub(makeData({ publicRepos: 10, reposWithCI: 6 }));
            expect(withCI.breakdown.codeQuality).toBeGreaterThan(noCI.breakdown.codeQuality);
        });

        it("rewards test presence", () => {
            const noTests = scoreGitHub(makeData({ publicRepos: 10 }));
            const withTests = scoreGitHub(makeData({ publicRepos: 10, topRepoTestIndicator: 0.8 }));
            expect(withTests.breakdown.codeQuality).toBeGreaterThan(noTests.breakdown.codeQuality);
        });

        it("rewards PR culture", () => {
            const noPR = scoreGitHub(makeData());
            const withPR = scoreGitHub(makeData({ totalPRsMerged: 50 }));
            expect(withPR.breakdown.codeQuality).toBeGreaterThan(noPR.breakdown.codeQuality);
        });

        it("rewards code review participation", () => {
            const noReview = scoreGitHub(makeData());
            const withReview = scoreGitHub(makeData({ codeReviewCount: 30 }));
            expect(withReview.breakdown.codeQuality).toBeGreaterThan(noReview.breakdown.codeQuality);
        });

        it("caps code quality at 80", () => {
            const maxed = scoreGitHub(makeData({
                publicRepos: 20,
                reposWithReadme: 10,
                reposWithCI: 10,
                topRepoTestIndicator: 1.0,
                totalPRsMerged: 500,
                codeReviewCount: 200,
            }));
            expect(maxed.breakdown.codeQuality).toBeLessThanOrEqual(80);
        });
    });

    it("never exceeds 300 total", () => {
        const maxed = scoreGitHub(makeData({
            accountAgeDays: 5000,
            publicRepos: 100,
            totalStars: 10000,
            followers: 5000,
            recentCommitCount: 500,
            longestRepoAgeDays: 5000,
            recentActiveWeeks: 52,
            languageDiversity: 10,
            ownerReputation: 1000,
            originalityScore: 1.0,
            reposWithReadme: 10,
            reposWithCI: 10,
            topRepoTestIndicator: 1.0,
            totalPRsMerged: 500,
            totalIssuesClosed: 200,
            codeReviewCount: 200,
            avgRepoSize: 5000,
        }));
        expect(maxed.score).toBeLessThanOrEqual(300);
    });

    it("includes all breakdown fields", () => {
        const result = scoreGitHub(makeData({ accountAgeDays: 200 }));
        expect(result.breakdown).toHaveProperty("accountAge");
        expect(result.breakdown).toHaveProperty("repoPortfolio");
        expect(result.breakdown).toHaveProperty("commitConsistency");
        expect(result.breakdown).toHaveProperty("communityTrust");
        expect(result.breakdown).toHaveProperty("codeQuality");
    });

    it("differentiates high-quality and low-quality profiles with same volume", () => {
        const lowQuality = scoreGitHub(makeData({
            accountAgeDays: 500,
            publicRepos: 20,
            recentCommitCount: 50,
            recentActiveWeeks: 10,
            originalityScore: 0.2,
            reposWithReadme: 1,
            reposWithCI: 0,
            topRepoTestIndicator: 0,
            totalPRsMerged: 2,
            codeReviewCount: 0,
        }));

        const highQuality = scoreGitHub(makeData({
            accountAgeDays: 500,
            publicRepos: 20,
            recentCommitCount: 50,
            recentActiveWeeks: 10,
            originalityScore: 0.9,
            reposWithReadme: 8,
            reposWithCI: 6,
            topRepoTestIndicator: 0.7,
            totalPRsMerged: 40,
            codeReviewCount: 20,
        }));

        expect(highQuality.score).toBeGreaterThan(lowQuality.score);
        expect(highQuality.breakdown.codeQuality).toBeGreaterThan(lowQuality.breakdown.codeQuality);
    });
});
