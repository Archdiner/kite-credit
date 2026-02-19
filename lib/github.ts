// ---------------------------------------------------------------------------
// GitHub data analysis and scoring (v2.1 — Scalability hardened)
// ---------------------------------------------------------------------------
// API Budget per user: ~8-10 calls (down from ~16)
//   1  /user
//   1  /user/repos
//   1  /users/:name/events
//   5  /repos/:owner/:repo/git/trees (sampled, down from 10)
//   3  /search/issues (PR, issue, review counts — uses separate 30/min quota)
//
// Caching: GitHubData is cached in the user_connections metadata for 24h.
// The score route should check the cache before calling fetchGitHubData.
// ---------------------------------------------------------------------------

import type { GitHubData, GitHubScore } from "@/types";

const GITHUB_API = "https://api.github.com";

let _lastRateLimitRemaining = 5000;

async function githubFetch(path: string, token: string) {
    const res = await fetch(`${GITHUB_API}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "kite-credit",
        },
    });

    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining) _lastRateLimitRemaining = parseInt(remaining, 10);

    if (res.status === 403 && _lastRateLimitRemaining < 5) {
        throw new Error("GitHub API rate limit exceeded. Please try again later.");
    }

    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

async function githubFetchSafe<T>(path: string, token: string, fallback: T): Promise<T> {
    try {
        if (_lastRateLimitRemaining < 10) return fallback;
        return await githubFetch(path, token);
    } catch {
        return fallback;
    }
}

export function getGitHubRateLimitRemaining(): number {
    return _lastRateLimitRemaining;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function getUserProfile(token: string) {
    return githubFetch("/user", token);
}

export async function getRepos(token: string) {
    return githubFetch("/user/repos?per_page=100&sort=updated&type=owner", token);
}

interface GitHubEvent {
    type: string;
    created_at: string;
}

export async function getCommitActivity(token: string, username: string) {
    const events = await githubFetch(
        `/users/${username}/events?per_page=100`,
        token
    ) as GitHubEvent[];

    const recentCommitCount = events.filter((e) => e.type === "PushEvent").length;

    const eventDates = events.map((e) => e.created_at.split("T")[0]);
    const uniqueWeeks = new Set(eventDates.map((d: string) => {
        const date = new Date(d);
        const onejan = new Date(date.getFullYear(), 0, 1);
        return Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    }));

    return {
        commitCount: recentCommitCount,
        activeWeeks: uniqueWeeks.size,
    };
}

const CI_INDICATORS = [
    ".github/workflows",
    ".circleci",
    ".travis.yml",
    "Jenkinsfile",
    ".gitlab-ci.yml",
];

const TEST_INDICATORS = [
    "test", "tests", "__tests__", "spec", "specs",
    "jest.config", "vitest.config", "pytest.ini", ".mocharc",
    "karma.conf", "cypress.config", "playwright.config",
];

interface RepoTreeItem {
    path: string;
    type: string;
}

async function analyzeRepoQuality(
    token: string,
    owner: string,
    repos: Array<{ name: string; default_branch: string; fork: boolean; size: number }>
) {
    const candidates = repos
        .filter(r => !r.fork && r.size > 5)
        .sort((a, b) => b.size - a.size)
        .slice(0, 5); // Reduced from 10 → 5 for rate limit budget

    let reposWithReadme = 0;
    let reposWithCI = 0;
    let reposWithTests = 0;

    for (const repo of candidates) {
        if (_lastRateLimitRemaining < 20) break;

        const tree: RepoTreeItem[] = await githubFetchSafe(
            `/repos/${owner}/${repo.name}/git/trees/${repo.default_branch}?recursive=1`,
            token,
            { tree: [] }
        ).then((d: { tree: RepoTreeItem[] }) => d.tree || []);

        const paths = tree.map((t: RepoTreeItem) => t.path.toLowerCase());

        if (paths.some(p => p === "readme.md" || p === "readme.rst" || p === "readme.txt" || p === "readme")) {
            reposWithReadme++;
        }

        if (paths.some(p => CI_INDICATORS.some(ci => p.startsWith(ci.toLowerCase())))) {
            reposWithCI++;
        }

        if (paths.some(p => TEST_INDICATORS.some(t => {
            const segment = p.split("/").pop() || "";
            return segment.startsWith(t) || p.includes(`/${t}/`);
        }))) {
            reposWithTests++;
        }
    }

    const sampled = candidates.length || 1;
    return {
        reposWithReadme,
        reposWithCI,
        topRepoTestIndicator: reposWithTests / sampled,
    };
}

async function getPRAndReviewActivity(token: string, username: string) {
    const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().split("T")[0];

    // These 3 hit the search API (separate 30/min limit)
    const [prSearch, issueSearch, reviewSearch] = await Promise.all([
        githubFetchSafe(
            `/search/issues?q=author:${username}+type:pr+is:merged+created:>${twoYearsAgo}&per_page=1`,
            token, { total_count: 0 }
        ) as Promise<{ total_count: number }>,
        githubFetchSafe(
            `/search/issues?q=author:${username}+type:issue+is:closed+created:>${twoYearsAgo}&per_page=1`,
            token, { total_count: 0 }
        ) as Promise<{ total_count: number }>,
        githubFetchSafe(
            `/search/issues?q=reviewed-by:${username}+type:pr+-author:${username}+created:>${twoYearsAgo}&per_page=1`,
            token, { total_count: 0 }
        ) as Promise<{ total_count: number }>,
    ]);

    return {
        totalPRsMerged: Math.min(prSearch.total_count, 9999),
        totalIssuesClosed: Math.min(issueSearch.total_count, 9999),
        codeReviewCount: Math.min(reviewSearch.total_count, 9999),
    };
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

export async function analyzeGitHub(token: string): Promise<GitHubData> {
    return fetchGitHubData(token);
}

export async function fetchGitHubData(token: string): Promise<GitHubData> {
    const profile = await getUserProfile(token);
    const repos = await getRepos(token);
    const commitActivity = await getCommitActivity(token, profile.login);

    const accountCreated = new Date(profile.created_at);
    const accountAgeDays = Math.floor(
        (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24)
    );

    const publicRepos = repos.filter((r: { private: boolean }) => !r.private);

    const languages = new Set<string>();
    let ownedRepoStars = 0;
    let nonForkCount = 0;
    let totalSize = 0;

    for (const repo of publicRepos) {
        if (repo.language) languages.add(repo.language);
        totalSize += (repo.size || 0);
        if (!repo.fork) {
            nonForkCount++;
            ownedRepoStars += (repo.stargazers_count || 0);
        }
    }

    const totalStars = publicRepos.reduce(
        (sum: number, r: { stargazers_count: number }) => sum + (r.stargazers_count || 0),
        0
    );

    let longestRepoAgeDays = 0;
    for (const repo of repos) {
        const repoAge = Math.floor(
            (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (repoAge > longestRepoAgeDays) longestRepoAgeDays = repoAge;
    }

    // Quality + PR signals in parallel
    const [qualityMetrics, prActivity] = await Promise.all([
        analyzeRepoQuality(token, profile.login, publicRepos),
        getPRAndReviewActivity(token, profile.login),
    ]);

    return {
        username: profile.login,
        accountAgeDays,
        publicRepos: publicRepos.length,
        totalStars,
        followers: profile.followers || 0,
        recentCommitCount: commitActivity.commitCount,
        longestRepoAgeDays,
        recentActiveWeeks: commitActivity.activeWeeks,
        languageDiversity: languages.size,
        ownerReputation: ownedRepoStars,
        originalityScore: publicRepos.length > 0 ? (nonForkCount / publicRepos.length) : 0,
        reposWithReadme: qualityMetrics.reposWithReadme,
        reposWithCI: qualityMetrics.reposWithCI,
        totalPRsMerged: prActivity.totalPRsMerged,
        totalIssuesClosed: prActivity.totalIssuesClosed,
        codeReviewCount: prActivity.codeReviewCount,
        avgRepoSize: publicRepos.length > 0 ? Math.floor(totalSize / publicRepos.length) : 0,
        topRepoTestIndicator: qualityMetrics.topRepoTestIndicator,
    };
}

// ---------------------------------------------------------------------------
// Scoring (0-300) — v2 with Code Quality dimension
// ---------------------------------------------------------------------------

export function scoreGitHub(data: GitHubData): GitHubScore {

    const accountAge = Math.min(40, Math.floor(
        data.accountAgeDays <= 0 ? 0
            : data.accountAgeDays < 90 ? (data.accountAgeDays / 90) * 10
                : data.accountAgeDays < 365 ? 10 + ((data.accountAgeDays - 90) / 275) * 12
                    : 22 + ((Math.min(data.accountAgeDays, 2000) - 365) / 1635) * 18
    ));

    const originality = Math.floor((data.originalityScore ?? 0) * 15);
    const diversity = Math.min(15, (data.languageDiversity || 0) * 3);
    const repoLongevity = Math.min(12, Math.floor(
        data.longestRepoAgeDays <= 0 ? 0 : (Math.min(data.longestRepoAgeDays, 1825) / 1825) * 12
    ));
    const volume = Math.min(18, Math.floor(Math.min(data.publicRepos, 18)));
    const repoPortfolio = Math.min(60, originality + diversity + repoLongevity + volume);

    const commitVolume = Math.min(50, Math.floor(
        data.recentCommitCount <= 0 ? 0
            : data.recentCommitCount < 20 ? (data.recentCommitCount / 20) * 18
                : data.recentCommitCount < 50 ? 18 + ((data.recentCommitCount - 20) / 30) * 18
                    : 36 + ((Math.min(data.recentCommitCount, 100) - 50) / 50) * 14
    ));
    let commitStreak = 0;
    if (data.recentActiveWeeks > 10) commitStreak = 20;
    else if (data.recentActiveWeeks > 5) commitStreak = 10;
    else if (data.recentActiveWeeks > 0) commitStreak = 4;
    const commitConsistency = Math.min(70, commitVolume + commitStreak);

    const followerScore = Math.min(25, Math.floor(
        data.followers <= 0 ? 0
            : data.followers < 50 ? (data.followers / 50) * 12
                : 12 + (Math.min(data.followers, 500) / 500) * 13
    ));
    const reputationScore = Math.min(25, Math.floor(
        data.ownerReputation <= 0 ? 0
            : data.ownerReputation < 10 ? data.ownerReputation
                : 10 + (Math.min(data.ownerReputation, 100) / 100) * 15
    ));
    const communityTrust = Math.min(50, followerScore + reputationScore);

    const readmeRatio = data.reposWithReadme / Math.max(1, Math.min(data.publicRepos, 10));
    const docScore = Math.min(20, Math.floor(readmeRatio * 20));
    const ciRatio = data.reposWithCI / Math.max(1, Math.min(data.publicRepos, 10));
    const ciScore = Math.min(15, Math.floor(ciRatio * 15));
    const testScore = Math.min(15, Math.floor((data.topRepoTestIndicator ?? 0) * 15));
    const prScore = Math.min(15, Math.floor(
        (data.totalPRsMerged ?? 0) <= 0 ? 0
            : (data.totalPRsMerged ?? 0) < 10 ? ((data.totalPRsMerged ?? 0) / 10) * 6
                : (data.totalPRsMerged ?? 0) < 50 ? 6 + (((data.totalPRsMerged ?? 0) - 10) / 40) * 5
                    : 11 + (Math.min((data.totalPRsMerged ?? 0), 200) / 200) * 4
    ));
    const reviewPts = Math.min(15, Math.floor(
        (data.codeReviewCount ?? 0) <= 0 ? 0
            : (data.codeReviewCount ?? 0) < 5 ? ((data.codeReviewCount ?? 0) / 5) * 5
                : (data.codeReviewCount ?? 0) < 20 ? 5 + (((data.codeReviewCount ?? 0) - 5) / 15) * 5
                    : 10 + (Math.min((data.codeReviewCount ?? 0), 100) / 100) * 5
    ));
    const codeQuality = Math.min(80, docScore + ciScore + testScore + prScore + reviewPts);

    const total = accountAge + repoPortfolio + commitConsistency + communityTrust + codeQuality;

    return {
        score: Math.min(300, total),
        breakdown: {
            accountAge,
            repoPortfolio,
            commitConsistency,
            communityTrust,
            codeQuality,
        },
    };
}
