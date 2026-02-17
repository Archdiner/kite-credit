// ---------------------------------------------------------------------------
// Scoring Engine -- The Lift Equation (v2)
// ---------------------------------------------------------------------------
// Combines sub-scores from on-chain and financial data into a single
// Kite Score (0-1000) with tier classification.
//
// Core score: On-chain (0-500, 50%) + Financial (0-500, 50%) = 0-1000
// Optional:   GitHub bonus (0-100) does NOT add to max but can boost
// ---------------------------------------------------------------------------

import type { ScoreTier, ScoreBreakdown, KiteScore } from "@/types";

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
// The Lift Equation v2
// ---------------------------------------------------------------------------
// Core scoring: on-chain (0-500) + financial (0-500) = 0-1000
// GitHub bonus: capped at +100, can push above core but never above 1000
// ---------------------------------------------------------------------------

export function calculateKiteScore(breakdown: ScoreBreakdown): {
    total: number;
    tier: ScoreTier;
} {
    const onChain = breakdown.onChain?.score ?? 0;
    const financial = breakdown.financial?.score ?? 0;

    // Core score: on-chain + financial
    const coreScore = onChain + financial;

    // GitHub bonus: scale down from 0-300 to 0-100
    const githubRaw = breakdown.github?.score ?? 0;
    const githubBonus = Math.floor((githubRaw / 300) * 100);

    const total = Math.min(1000, coreScore + githubBonus);
    const tier = getTier(total);

    return { total, tier };
}

// ---------------------------------------------------------------------------
// Partial scoring support
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
    if (breakdown.onChain) max += 500;
    if (breakdown.financial) max += 500;
    // GitHub bonus is non-essential, don't count it in max
    return max || 1000;
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
