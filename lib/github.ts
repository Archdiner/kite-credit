// ---------------------------------------------------------------------------
// GitHub data analysis and scoring
// ---------------------------------------------------------------------------
// Fetches professional activity data from GitHub's REST API and produces
// the professional sub-score (30% of the Kite Score, range 0-300).
// ---------------------------------------------------------------------------

import type { GitHubData, GitHubScore } from "@/types";

const GITHUB_API = "https://api.github.com";

async function githubFetch(path: string, token: string) {
    const res = await fetch(`${GITHUB_API}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "kite-credit",
        },
    });

    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function getUserProfile(token: string) {
    return githubFetch("/user", token);
}

export async function getRepos(token: string) {
    // Get up to 100 repos sorted by most recently updated
    const repos = await githubFetch(
        "/user/repos?per_page=100&sort=updated&type=owner",
        token
    );
    return repos;
}

export async function getCommitActivity(token: string, username: string) {
    // Get contribution events from the past year
    // We use the events endpoint which gives recent activity
    const events = await githubFetch(
        `/users/${username}/events?per_page=100`,
        token
    );

    // Count push events (commits)
    const pushEvents = events.filter(
        (e: { type: string }) => e.type === "PushEvent"
    );

    // Count commits across push events
    let totalCommits = 0;
    for (const event of pushEvents) {
        totalCommits += event.payload?.commits?.length || 0;
    }

    // Estimate weekly consistency from event timestamps
    const now = new Date();
    const weekBuckets = new Set<string>();
    for (const event of pushEvents) {
        const eventDate = new Date(event.created_at);
        const weekNum = Math.floor(
            (now.getTime() - eventDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        weekBuckets.add(String(weekNum));
    }

    return {
        commitCount: totalCommits,
        activeWeeks: weekBuckets.size,
    };
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

export async function analyzeGitHub(token: string): Promise<GitHubData> {
    const profile = await getUserProfile(token);
    const repos = await getRepos(token);
    const commitActivity = await getCommitActivity(token, profile.login);

    const accountCreated = new Date(profile.created_at);
    const accountAgeDays = Math.floor(
        (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate repo stats
    const publicRepos = repos.filter((r: { private: boolean }) => !r.private);
    const totalStars = publicRepos.reduce(
        (sum: number, r: { stargazers_count: number }) =>
            sum + (r.stargazers_count || 0),
        0
    );

    // Find the oldest repo
    let longestRepoAgeDays = 0;
    for (const repo of repos) {
        const repoAge = Math.floor(
            (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (repoAge > longestRepoAgeDays) {
            longestRepoAgeDays = repoAge;
        }
    }

    return {
        username: profile.login,
        accountAgeDays,
        publicRepos: publicRepos.length,
        totalStars,
        followers: profile.followers || 0,
        commitsLastYear: commitActivity.commitCount,
        longestRepoAgeDays,
        contributionStreak: commitActivity.activeWeeks,
    };
}

// ---------------------------------------------------------------------------
// Scoring (0-300)
// ---------------------------------------------------------------------------

export function scoreGitHub(data: GitHubData): GitHubScore {
    // Account age: 0-50
    // 0 days = 0, 90 days = 15, 365 days = 30, 1000+ days = 50
    const accountAge = Math.min(50, Math.floor(
        data.accountAgeDays <= 0
            ? 0
            : data.accountAgeDays < 90
                ? (data.accountAgeDays / 90) * 15
                : data.accountAgeDays < 365
                    ? 15 + ((data.accountAgeDays - 90) / 275) * 15
                    : 30 + ((Math.min(data.accountAgeDays, 2000) - 365) / 1635) * 20
    ));

    // Repo portfolio: 0-75
    // Considers number of repos, stars, and the age of the longest-running repo
    const repoCount = Math.min(25, Math.floor(
        Math.min(data.publicRepos, 25)
    ));
    const starScore = Math.min(25, Math.floor(
        data.totalStars <= 0
            ? 0
            : data.totalStars < 10
                ? (data.totalStars / 10) * 10
                : data.totalStars < 100
                    ? 10 + ((data.totalStars - 10) / 90) * 10
                    : 20 + (Math.min(data.totalStars, 1000) / 1000) * 5
    ));
    const repoLongevity = Math.min(25, Math.floor(
        data.longestRepoAgeDays <= 0
            ? 0
            : (Math.min(data.longestRepoAgeDays, 1825) / 1825) * 25 // 5 years max
    ));
    const repoPortfolio = Math.min(75, repoCount + starScore + repoLongevity);

    // Commit consistency: 0-100
    // Recent commits and weekly streak
    const commitVolume = Math.min(50, Math.floor(
        data.commitsLastYear <= 0
            ? 0
            : data.commitsLastYear < 50
                ? (data.commitsLastYear / 50) * 20
                : data.commitsLastYear < 200
                    ? 20 + ((data.commitsLastYear - 50) / 150) * 15
                    : 35 + (Math.min(data.commitsLastYear, 1000) / 1000) * 15
    ));
    const streakScore = Math.min(50, Math.floor(
        data.contributionStreak <= 0
            ? 0
            : (Math.min(data.contributionStreak, 26) / 26) * 50 // 26 weeks = half year
    ));
    const commitConsistency = Math.min(100, commitVolume + streakScore);

    // Community trust: 0-75
    // Followers as a proxy for community recognition
    const communityTrust = Math.min(75, Math.floor(
        data.followers <= 0
            ? 0
            : data.followers < 10
                ? (data.followers / 10) * 15
                : data.followers < 50
                    ? 15 + ((data.followers - 10) / 40) * 20
                    : data.followers < 200
                        ? 35 + ((data.followers - 50) / 150) * 20
                        : 55 + (Math.min(data.followers, 1000) / 1000) * 20
    ));

    const total = accountAge + repoPortfolio + commitConsistency + communityTrust;

    return {
        score: Math.min(300, total),
        breakdown: {
            accountAge,
            repoPortfolio,
            commitConsistency,
            communityTrust,
        },
    };
}
