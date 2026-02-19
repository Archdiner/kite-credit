// ---------------------------------------------------------------------------
// GitHub Scoring Validation — Known Developer Profiles
// ---------------------------------------------------------------------------
// Tests scoring against realistic profiles matching known developers.
// Validates that scores align with expectations:
//   - Elite devs (5+ years, prolific OSS) → 230-300
//   - Strong devs (2-5 years, quality-focused) → 150-230
//   - Building devs (new, learning) → 30-100
// ---------------------------------------------------------------------------

import { scoreGitHub } from "../github";
import type { GitHubData } from "@/types";

function makeProfile(overrides: Partial<GitHubData>): GitHubData {
    return {
        username: "test",
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

describe("Known Developer Profile Scoring", () => {

    // -----------------------------------------------------------------------
    // Profile: "Archdiner" — Active fullstack dev, multi-project contributor
    // Expected: Strong tier (170-230 range)
    // -----------------------------------------------------------------------
    describe("Archdiner — Active fullstack developer", () => {
        const archdiner = makeProfile({
            username: "Archdiner",
            accountAgeDays: 900,           // ~2.5 years on GitHub
            publicRepos: 25,               // Solid portfolio
            totalStars: 15,                // Modest star count
            followers: 12,                 // Growing community
            recentCommitCount: 55,         // Active recent work
            longestRepoAgeDays: 800,       // Has maintained projects
            recentActiveWeeks: 12,         // Consistent contributor
            languageDiversity: 5,          // TypeScript, Python, Solidity, Rust, JavaScript
            ownerReputation: 10,           // Some stars on owned repos
            originalityScore: 0.8,         // Mostly original work
            reposWithReadme: 4,            // Good docs on top repos
            reposWithCI: 3,               // Uses CI in several projects
            totalPRsMerged: 35,           // Collaborative worker
            totalIssuesClosed: 15,        // Engages with issues
            codeReviewCount: 10,          // Reviews peers' code
            avgRepoSize: 2500,            // Non-trivial projects
            topRepoTestIndicator: 0.6,    // Tests in most top repos
        });

        const result = scoreGitHub(archdiner);

        it("scores in Strong range (170-250)", () => {
            expect(result.score).toBeGreaterThanOrEqual(170);
            expect(result.score).toBeLessThanOrEqual(250);
        });

        it("has good code quality score (35+)", () => {
            expect(result.breakdown.codeQuality).toBeGreaterThanOrEqual(35);
        });

        it("has solid commit consistency", () => {
            expect(result.breakdown.commitConsistency).toBeGreaterThanOrEqual(40);
        });

        it("values repo portfolio (originality + diversity)", () => {
            expect(result.breakdown.repoPortfolio).toBeGreaterThanOrEqual(30);
        });

        it("produces a complete breakdown", () => {
            console.log("\n📊 Archdiner Score Breakdown:");
            console.log(`   Total: ${result.score}/300`);
            console.log(`   Account Age:        ${result.breakdown.accountAge}/40`);
            console.log(`   Repo Portfolio:     ${result.breakdown.repoPortfolio}/60`);
            console.log(`   Commit Consistency: ${result.breakdown.commitConsistency}/70`);
            console.log(`   Community Trust:    ${result.breakdown.communityTrust}/50`);
            console.log(`   Code Quality:       ${result.breakdown.codeQuality}/80`);
        });
    });

    // -----------------------------------------------------------------------
    // Profile: "sindresorhus" archetype — Prolific OSS maintainer
    // Expected: Elite tier (250-300)
    // -----------------------------------------------------------------------
    describe("Prolific OSS maintainer (sindresorhus archetype)", () => {
        const ossMaintainer = makeProfile({
            username: "oss-maintainer",
            accountAgeDays: 4500,          // 12+ years on GitHub
            publicRepos: 100,              // Max count we fetch
            totalStars: 50000,             // Major OSS impact
            followers: 3000,               // Large following
            recentCommitCount: 80,         // Very active
            longestRepoAgeDays: 4200,      // Decade-old repos
            recentActiveWeeks: 20,         // Consistently active
            languageDiversity: 8,          // TypeScript, JS, Go, Rust, Python, Shell, CSS, Ruby
            ownerReputation: 500,          // Massive star count on owned repos
            originalityScore: 0.95,        // Almost all original work
            reposWithReadme: 5,            // All sampled repos have READMEs
            reposWithCI: 5,               // All sampled repos have CI
            totalPRsMerged: 500,          // Massive PR history
            totalIssuesClosed: 1000,      // Huge issue engagement
            codeReviewCount: 200,         // Major reviewer
            avgRepoSize: 800,             // Focused utilities
            topRepoTestIndicator: 1.0,    // Tests everywhere
        });

        const result = scoreGitHub(ossMaintainer);

        it("scores near maximum (260+)", () => {
            expect(result.score).toBeGreaterThanOrEqual(260);
        });

        it("has near-max code quality (60+)", () => {
            expect(result.breakdown.codeQuality).toBeGreaterThanOrEqual(60);
        });

        it("maxes community trust", () => {
            expect(result.breakdown.communityTrust).toBeGreaterThanOrEqual(45);
        });

        it("produces breakdown", () => {
            console.log("\n📊 OSS Maintainer Score Breakdown:");
            console.log(`   Total: ${result.score}/300`);
            console.log(`   Account Age:        ${result.breakdown.accountAge}/40`);
            console.log(`   Repo Portfolio:     ${result.breakdown.repoPortfolio}/60`);
            console.log(`   Commit Consistency: ${result.breakdown.commitConsistency}/70`);
            console.log(`   Community Trust:    ${result.breakdown.communityTrust}/50`);
            console.log(`   Code Quality:       ${result.breakdown.codeQuality}/80`);
        });
    });

    // -----------------------------------------------------------------------
    // Profile: "tj" archetype — Express/Koa creator, legendary but less recent
    // Expected: Strong-to-Elite (200-270)
    // -----------------------------------------------------------------------
    describe("Legendary dev, less recently active (tj archetype)", () => {
        const legendaryDev = makeProfile({
            username: "legendary-dev",
            accountAgeDays: 5000,          // 13+ years
            publicRepos: 80,
            totalStars: 30000,
            followers: 2000,
            recentCommitCount: 8,          // Less active recently
            longestRepoAgeDays: 5000,
            recentActiveWeeks: 3,          // Sporadic
            languageDiversity: 6,
            ownerReputation: 400,
            originalityScore: 0.9,
            reposWithReadme: 5,
            reposWithCI: 3,
            totalPRsMerged: 200,
            totalIssuesClosed: 500,
            codeReviewCount: 100,
            avgRepoSize: 1500,
            topRepoTestIndicator: 0.8,
        });

        const result = scoreGitHub(legendaryDev);

        it("still scores high despite lower recent activity (200+)", () => {
            expect(result.score).toBeGreaterThanOrEqual(200);
        });

        it("account age and portfolio carry the score", () => {
            expect(result.breakdown.accountAge).toBeGreaterThanOrEqual(35);
            expect(result.breakdown.repoPortfolio).toBeGreaterThanOrEqual(45);
        });

        it("commit consistency is lower due to inactivity", () => {
            expect(result.breakdown.commitConsistency).toBeLessThan(20);
        });

        it("produces breakdown", () => {
            console.log("\n📊 Legendary Dev Score Breakdown:");
            console.log(`   Total: ${result.score}/300`);
            console.log(`   Account Age:        ${result.breakdown.accountAge}/40`);
            console.log(`   Repo Portfolio:     ${result.breakdown.repoPortfolio}/60`);
            console.log(`   Commit Consistency: ${result.breakdown.commitConsistency}/70`);
            console.log(`   Community Trust:    ${result.breakdown.communityTrust}/50`);
            console.log(`   Code Quality:       ${result.breakdown.codeQuality}/80`);
        });
    });

    // -----------------------------------------------------------------------
    // Profile: Bootcamp graduate — New, few repos, no quality signals
    // Expected: Building (30-80)
    // -----------------------------------------------------------------------
    describe("Bootcamp graduate — new developer", () => {
        const bootcamper = makeProfile({
            username: "newdev2025",
            accountAgeDays: 60,
            publicRepos: 6,
            totalStars: 0,
            followers: 2,
            recentCommitCount: 15,
            longestRepoAgeDays: 50,
            recentActiveWeeks: 4,
            languageDiversity: 2,
            ownerReputation: 0,
            originalityScore: 0.5,        // Half forked tutorials
            reposWithReadme: 1,
            reposWithCI: 0,
            totalPRsMerged: 0,
            totalIssuesClosed: 0,
            codeReviewCount: 0,
            avgRepoSize: 300,
            topRepoTestIndicator: 0,
        });

        const result = scoreGitHub(bootcamper);

        it("scores in Building range (30-100)", () => {
            expect(result.score).toBeGreaterThanOrEqual(30);
            expect(result.score).toBeLessThan(100);
        });

        it("has low code quality (no CI, no tests, no PRs)", () => {
            expect(result.breakdown.codeQuality).toBeLessThan(10);
        });

        it("produces breakdown", () => {
            console.log("\n📊 Bootcamp Graduate Score Breakdown:");
            console.log(`   Total: ${result.score}/300`);
            console.log(`   Account Age:        ${result.breakdown.accountAge}/40`);
            console.log(`   Repo Portfolio:     ${result.breakdown.repoPortfolio}/60`);
            console.log(`   Commit Consistency: ${result.breakdown.commitConsistency}/70`);
            console.log(`   Community Trust:    ${result.breakdown.communityTrust}/50`);
            console.log(`   Code Quality:       ${result.breakdown.codeQuality}/80`);
        });
    });

    // -----------------------------------------------------------------------
    // Profile: "Spam account" — High volume, low quality
    // Should score LOWER than a quality-focused dev with same age
    // -----------------------------------------------------------------------
    describe("Spam account — high volume, zero quality", () => {
        const spammer = makeProfile({
            username: "githubspammer",
            accountAgeDays: 400,
            publicRepos: 50,
            totalStars: 0,
            followers: 1,
            recentCommitCount: 90,         // Lots of commits
            longestRepoAgeDays: 300,
            recentActiveWeeks: 15,
            languageDiversity: 1,          // Only JavaScript
            ownerReputation: 0,
            originalityScore: 0.1,         // Almost all forks
            reposWithReadme: 0,
            reposWithCI: 0,
            totalPRsMerged: 0,
            totalIssuesClosed: 0,
            codeReviewCount: 0,
            avgRepoSize: 50,
            topRepoTestIndicator: 0,
        });

        const qualityDev = makeProfile({
            username: "qualitydev",
            accountAgeDays: 400,
            publicRepos: 12,
            totalStars: 5,
            followers: 8,
            recentCommitCount: 30,         // Fewer commits
            longestRepoAgeDays: 300,
            recentActiveWeeks: 8,
            languageDiversity: 4,
            ownerReputation: 5,
            originalityScore: 0.9,
            reposWithReadme: 4,
            reposWithCI: 3,
            totalPRsMerged: 25,
            totalIssuesClosed: 10,
            codeReviewCount: 15,
            avgRepoSize: 2000,
            topRepoTestIndicator: 0.7,
        });

        const spamResult = scoreGitHub(spammer);
        const qualityResult = scoreGitHub(qualityDev);

        it("quality dev scores HIGHER than spammer", () => {
            expect(qualityResult.score).toBeGreaterThan(spamResult.score);
        });

        it("spammer has near-zero code quality", () => {
            expect(spamResult.breakdown.codeQuality).toBe(0);
        });

        it("quality dev has substantial code quality (35+)", () => {
            expect(qualityResult.breakdown.codeQuality).toBeGreaterThanOrEqual(35);
        });

        it("produces comparison", () => {
            console.log("\n📊 Spam vs Quality Comparison:");
            console.log(`   Spammer:    ${spamResult.score}/300 (Quality: ${spamResult.breakdown.codeQuality}/80)`);
            console.log(`   Quality:    ${qualityResult.score}/300 (Quality: ${qualityResult.breakdown.codeQuality}/80)`);
            console.log(`   Delta:      +${qualityResult.score - spamResult.score} for quality dev`);
        });
    });
});
