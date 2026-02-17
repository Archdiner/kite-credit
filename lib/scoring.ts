// ---------------------------------------------------------------------------
// FICO-Inspired Scoring Engine v3
// ---------------------------------------------------------------------------
// Calculates the comprehensive Kite Score (0-1000) based on the "5 Factors":
// 1. Payment History (35%) - 350 pts
// 2. Utilization (30%) - 300 pts
// 3. Credit Age (15%) - 150 pts
// 4. Credit Mix (10%) - 100 pts
// 5. New Credit (10%) - 100 pts
// + GitHub Bonus (+50 pts)
// ---------------------------------------------------------------------------

import type {
    KiteScore,
    ScoreBreakdown,
    FiveFactorBreakdown,
    OnChainScore,
    FinancialScore,
    GitHubScore,
    ScoreTier,
} from "@/types";

interface AssembleParams {
    onChain: OnChainScore;
    financial: FinancialScore | null;
    github: GitHubScore | null;
}

export function assembleKiteScore(
    data: AssembleParams,
    explanation: string
): KiteScore {
    const { onChainWeight, financialWeight, totalStrength } = calculateDynamicWeights(data.onChain, data.financial);

    const breakdown = calculateFiveFactorScore(data.onChain, data.financial, { onChain: onChainWeight, financial: financialWeight });

    // Sum up the 5 factors
    let coreScore =
        breakdown.paymentHistory.score +
        breakdown.utilization.score +
        breakdown.creditAge.score +
        breakdown.creditMix.score +
        breakdown.newCredit.score;

    // SYNERGY BOOST: If user has significant presence in BOTH (Hybrid), add a multiplier
    // Encourages connecting both even if one is weaker.
    if (onChainWeight > 0.3 && financialWeight > 0.3) {
        coreScore = Math.min(1000, Math.floor(coreScore * 1.1)); // 10% Boost for bridging worlds
    }

    // TRUST DAMPENER: If total signal strength is very low (e.g. new wallet, no bank),
    // cap the score to prevent "spamming" high scores with fresh accounts.
    if (totalStrength < 0.3) {
        const dampener = 0.5 + (totalStrength / 0.6); // Scales from 0.5x to 1.0x
        coreScore = Math.floor(coreScore * dampener);
    }

    // Add GitHub bonus
    const githubBonus = data.github ? Math.min(50, Math.floor(data.github.score / 6)) : 0;

    const total = Math.min(1000, coreScore + githubBonus);
    const tier = getTier(total);

    return {
        total,
        tier,
        breakdown: {
            onChain: data.onChain,
            financial: data.financial,
            github: data.github,
            fiveFactor: breakdown,
        } as ScoreBreakdown,
        githubBonus,
        explanation,
        weights: {
            onChain: onChainWeight,
            financial: financialWeight
        },
        timestamp: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Dynamic Weighting Logic (Signal Strength Model)
// ---------------------------------------------------------------------------

function calculateSignalStrength(onChain: OnChainScore, financial: FinancialScore | null): { onChainStrength: number, financialStrength: number } {
    // 1. On-Chain Strength (0.0 - 1.0)
    // Based on wallet age and activity depth
    // Sigmoid-like scaling for age: 1 day ~ 0.1, 90 days ~ 0.8, 1 year ~ 1.0
    const ageBonus = Math.min(1, Math.log10(Math.max(1, onChain.breakdown.walletAge)) / 2.5); // log10(365) ~ 2.56

    // Activity bonus based on raw score (0-500)
    // Score 100 ~ 0.2, Score 400 ~ 0.8
    const scoreBonus = Math.min(1, onChain.score / 450);

    // WEIGHTED STRENGTH:
    // If age is low, scoreBonus contributes LESS (prevents spamming txs on new wallet)
    // If age is high, scoreBonus contributes MORE
    const ageFactor = Math.max(0.2, ageBonus); // Min 0.2 to allow *some* credit for new active wallets
    const onChainStrength = (ageBonus * 0.4) + (scoreBonus * 0.6 * ageFactor);

    // 2. Financial Strength (0.0 - 1.0)
    if (!financial || !financial.verified) return { onChainStrength, financialStrength: 0 };

    // Base trust for verification
    let finStrength = 0.5;

    // Bonus for Income Consistency (0-165 pts in breakdown)
    const incomeRatio = Math.min(1, financial.breakdown.incomeConsistency / 100);
    finStrength += (incomeRatio * 0.3);

    // Bonus for Balance Health (0-250 pts)
    const balanceRatio = Math.min(1, financial.breakdown.balanceHealth / 150);
    finStrength += (balanceRatio * 0.2);

    return {
        onChainStrength: Math.min(1, Math.max(0.01, onChainStrength)),
        financialStrength: Math.min(1, finStrength)
    };
}

function calculateDynamicWeights(onChain: OnChainScore, financial: FinancialScore | null): { onChainWeight: number, financialWeight: number, totalStrength: number } {
    const { onChainStrength, financialStrength } = calculateSignalStrength(onChain, financial);

    const totalStrength = onChainStrength + financialStrength;

    // Safety check div by zero
    if (totalStrength < 0.01) return { onChainWeight: 1, financialWeight: 0, totalStrength };

    let onChainWeight = onChainStrength / totalStrength;
    let financialWeight = financialStrength / totalStrength;

    // Edge Case: "Newcomer Penalty" / "Trust Anchor"
    // If one side is VERY strong (>0.8) and other is VERY weak (<0.1),
    // we skew even harder to the strong side to avoid dragging down the score.
    if (financialStrength > 0.8 && onChainStrength < 0.2) {
        financialWeight = 0.95;
        onChainWeight = 0.05;
    } else if (onChainStrength > 0.8 && financialStrength < 0.2) {
        onChainWeight = 0.95;
        financialWeight = 0.05;
    }

    return { onChainWeight, financialWeight, totalStrength };
}

function calculateFiveFactorScore(
    onChain: OnChainScore,
    financial: FinancialScore | null,
    weights: { onChain: number, financial: number }
): FiveFactorBreakdown {

    // Helper to blend scores based on dynamic weights
    // We scale the inputs to the target max points for the category
    const blend = (onChainRaw: number, onChainMax: number, finRaw: number, finMax: number, categoryMax: number) => {
        const onChainContrib = (onChainRaw / onChainMax) * categoryMax * weights.onChain;
        const finContrib = financial ? (finRaw / finMax) * categoryMax * weights.financial : 0;

        // If financial is missing, onChain takes 100% of the weight (handled by weights.financial being 0 or low)
        // But if weights are 50/50, we simply add them.
        // However, if financial is missing, calculateDynamicWeights should have returned onChainWeight=1.0

        return Math.floor(onChainContrib + finContrib);
    };

    // -------------------------------------------------------------------------
    // 1. Payment History (35%) - Max 350 pts
    // -------------------------------------------------------------------------
    const paymentHistoryScore = blend(
        onChain.breakdown.repaymentHistory, 125,
        financial?.breakdown.incomeConsistency ?? 0, 165,
        350
    );

    // -------------------------------------------------------------------------
    // 2. Utilization (30%) - Max 300 pts
    // -------------------------------------------------------------------------
    const utilizationScore = blend(
        onChain.breakdown.staking, 60,
        financial?.breakdown.balanceHealth ?? 0, 250,
        300
    );

    // -------------------------------------------------------------------------
    // 3. Credit Age (15%) - Max 150 pts
    // -------------------------------------------------------------------------
    // Financial usually doesn't give us account "age" in MVP, so we lean on wallet age
    // But if we are 95% TradFi, we should ideally use bank data. 
    // For MVP, we'll give a "verified" base bonus for TradFi users in this category.
    let creditAgeScore = Math.floor((onChain.breakdown.walletAge / 125) * 150 * weights.onChain);

    if (financial && weights.financial > 0.5) {
        // If TradFi dominated, assume "mature" financial life if verified
        // Tuning: Reduce proxy weight. Income consistency is good, but "Age" takes years.
        // Cap the max proxy age score to 75% (112 pts) unless we have explicit account items.
        const proxyAge = Math.min(0.75, financial.breakdown.incomeConsistency / 165) * 150;
        creditAgeScore += Math.floor(proxyAge * weights.financial);
    }

    // -------------------------------------------------------------------------
    // 4. Credit Mix (10%) - Max 100 pts
    // -------------------------------------------------------------------------
    let creditMixScore = Math.floor((onChain.breakdown.deFiActivity / 190) * 100 * weights.onChain);
    if (financial && weights.financial > 0.5) {
        // Proxy mix for TradFi: Did they connect a major bank?
        // verificationBonus captures this.
        // Tuning: Be conservative. Verification is just ONE type of credit (Bank). 
        // 50% max score for just having a bank account.
        const proxyMix = Math.min(0.5, financial.breakdown.verificationBonus / 85) * 100;
        creditMixScore += Math.floor(proxyMix * weights.financial);
    }

    // -------------------------------------------------------------------------
    // 5. New Credit (10%) - Max 100 pts
    // -------------------------------------------------------------------------
    // "Recent inquiries" - difficult to track on-chain without indexing.
    // We treat "Verification Bonus" as a "Safe" signal for TradFi.
    const newCreditOnChain = 75; // Baseline safe
    let newCreditScore = Math.floor(newCreditOnChain * 100 / 100 * weights.onChain); // 100 pts max

    if (financial) {
        const finNewCredit = (financial.breakdown.verificationBonus / 85) * 100;
        newCreditScore += Math.floor(finNewCredit * weights.financial);
    }

    return {
        paymentHistory: {
            score: paymentHistoryScore,
            details: {
                onChainRepayments: Math.floor(paymentHistoryScore * weights.onChain),
                bankBillPay: Math.floor(paymentHistoryScore * weights.financial)
            }
        },
        utilization: {
            score: utilizationScore,
            details: {
                creditUtilization: 0,
                collateralHealth: Math.floor(utilizationScore * weights.onChain),
                balanceRatio: Math.floor(utilizationScore * weights.financial)
            }
        },
        creditAge: {
            score: creditAgeScore,
            details: {
                walletAge: creditAgeScore,
                accountAge: 0
            }
        },
        creditMix: {
            score: creditMixScore,
            details: {
                protocolDiversity: creditMixScore,
                accountDiversity: 0
            }
        },
        newCredit: {
            score: newCreditScore,
            details: {
                recentInquiries: 0,
                recentOpenings: 0
            }
        }
    };
}

// Updated tiers to match brand identity
export function getTier(score: number): ScoreTier {
    if (score >= 800) return "Elite";   // 800-1000
    if (score >= 700) return "Strong";  // 700-799
    if (score >= 600) return "Steady";  // 600-699
    return "Building";                  // 0-599
}

export function getConnectedSources(breakdown: ScoreBreakdown): string[] {
    const sources: string[] = ["solana_active"]; // Always present if we have a score

    if (breakdown.financial?.verified) {
        sources.push("bank_verified");
    }

    if (breakdown.github) {
        sources.push("github_linked");
    }

    return sources;
}
