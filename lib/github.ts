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
    // For now, we'll use a heuristic based on recent activity since we can't easily get full year without GraphQL
    // const commitsLastYear = events.filter((e: any) => e.type === "PushEvent").length;
    // Actually, let's call it "recentCommitCount" (approx last 90 days of events)
    const recentCommitCount = events.filter((e: any) => e.type === "PushEvent").length;

    // Estimate active weeks (rough approximation from event dates)
    const eventDates = events.map((e: any) => e.created_at.split('T')[0]);
    const uniqueWeeks = new Set(eventDates.map((d: string) => {
        const date = new Date(d);
        const onejan = new Date(date.getFullYear(), 0, 1);
        return Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    }));
    const recentActiveWeeks = uniqueWeeks.size;

    return {
        commitCount: recentCommitCount, // Renamed
        activeWeeks: recentActiveWeeks, // Renamed
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
        recentCommitCount: commitActivity.commitCount,
        longestRepoAgeDays,
        recentActiveWeeks: commitActivity.activeWeeks,
    };
}

// ---------------------------------------------------------------------------
// Scoring (0-300)
// ---------------------------------------------------------------------------

export function scoreGitHub(data: GitHubData): GitHubScore {
    let score = 0;

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
    // Consistency Score (up to 30 points)
    if (data.recentActiveWeeks > 10) score += 30;
    else if (data.recentActiveWeeks > 5) score += 15;
    else if (data.recentActiveWeeks > 0) score += 5;
    const commitConsistency = Math.min(100, score); // This line needs to be adjusted based on the new scoring logic

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
