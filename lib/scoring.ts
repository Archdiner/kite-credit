// ---------------------------------------------------------------------------
// Scoring Engine -- The Lift Equation
// ---------------------------------------------------------------------------
// Combines sub-scores from on-chain, GitHub, and financial data into a
// single Kite Score (0-1000) with tier classification.
// ---------------------------------------------------------------------------

import type { ScoreTier, ScoreBreakdown, KiteScore, OnChainScore, GitHubScore, FinancialScore } from "@/types";

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

export function getTier(score: number): ScoreTier {
    if (score <= 300) return "Building";
    if (score <= 550) return "Steady";
    if (score <= 750) return "Strong";
    return "Elite";
}

// ---------------------------------------------------------------------------
// The Lift Equation
// ---------------------------------------------------------------------------
// The sub-scores are already weighted to their correct ranges:
//   On-chain:  0-400 (40%)
//   GitHub:    0-300 (30%)
//   Financial: 0-300 (30%)
// Total range: 0-1000
// ---------------------------------------------------------------------------

export function calculateKiteScore(breakdown: ScoreBreakdown): {
    total: number;
    tier: ScoreTier;
} {
    const onChain = breakdown.onChain?.score ?? 0;
    const github = breakdown.github?.score ?? 0;
    const financial = breakdown.financial?.score ?? 0;

    const total = Math.min(1000, onChain + github + financial);
    const tier = getTier(total);

    return { total, tier };
}

// ---------------------------------------------------------------------------
// Partial scoring support
// ---------------------------------------------------------------------------
// Users may not have all three data sources connected. We still produce
// a score from whatever is available, but we indicate which sources are
// missing so the dashboard can prompt the user to connect them.
// ---------------------------------------------------------------------------

export function getConnectedSources(breakdown: ScoreBreakdown): string[] {
    const sources: string[] = [];
    if (breakdown.onChain) sources.push("solana_active");
    if (breakdown.github) sources.push("github_linked");
    if (breakdown.financial) sources.push("bank_verified");
    return sources;
}

export function getMaxPossibleScore(breakdown: ScoreBreakdown): number {
    let max = 0;
    if (breakdown.onChain) max += 400; else max += 0;
    if (breakdown.github) max += 300; else max += 0;
    if (breakdown.financial) max += 300; else max += 0;
    return max || 1000; // If nothing connected, show out of 1000
}

// ---------------------------------------------------------------------------
// Full score assembly
// ---------------------------------------------------------------------------

export function assembleKiteScore(
    breakdown: ScoreBreakdown,
    explanation: string
): KiteScore {
    const { total, tier } = calculateKiteScore(breakdown);

    return {
        total,
        tier,
        breakdown,
        explanation,
        timestamp: new Date().toISOString(),
    };
}
