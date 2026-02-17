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
    const breakdown = calculateFiveFactorScore(data.onChain, data.financial);

    // Sum up the 5 factors
    const coreScore =
        breakdown.paymentHistory.score +
        breakdown.utilization.score +
        breakdown.creditAge.score +
        breakdown.creditMix.score +
        breakdown.newCredit.score;

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
        timestamp: new Date().toISOString(),
    };
}

function calculateFiveFactorScore(
    onChain: OnChainScore,
    financial: FinancialScore | null
): FiveFactorBreakdown {
    // -------------------------------------------------------------------------
    // 1. Payment History (35%) - Max 350 pts
    // -------------------------------------------------------------------------
    const onChainPaymentScore = Math.min(175, Math.floor((onChain.breakdown.repaymentHistory / 125) * 175));
    const bankPaymentScore = financial
        ? Math.min(175, Math.floor((financial.breakdown.incomeConsistency / 165) * 175))
        : 0;

    const paymentHistoryScore = onChainPaymentScore + bankPaymentScore;

    // -------------------------------------------------------------------------
    // 2. Utilization (30%) - Max 300 pts
    // -------------------------------------------------------------------------
    const onChainUtilization = Math.min(150, Math.floor((onChain.breakdown.staking / 60) * 150));
    const bankUtilization = financial
        ? Math.min(150, Math.floor((financial.breakdown.balanceHealth / 250) * 150))
        : 0;

    const utilizationScore = onChainUtilization + bankUtilization;

    // -------------------------------------------------------------------------
    // 3. Credit Age (15%) - Max 150 pts
    // -------------------------------------------------------------------------
    const creditAgeScore = Math.min(150, Math.floor((onChain.breakdown.walletAge / 125) * 150));

    // -------------------------------------------------------------------------
    // 4. Credit Mix (10%) - Max 100 pts
    // -------------------------------------------------------------------------
    const creditMixScore = Math.min(100, Math.floor((onChain.breakdown.deFiActivity / 190) * 100));

    // -------------------------------------------------------------------------
    // 5. New Credit (10%) - Max 100 pts
    // -------------------------------------------------------------------------
    const newCreditScore = financial
        ? Math.min(100, Math.floor((financial.breakdown.verificationBonus / 85) * 100))
        : 50;

    return {
        paymentHistory: {
            score: paymentHistoryScore,
            details: {
                onChainRepayments: onChainPaymentScore,
                bankBillPay: bankPaymentScore
            }
        },
        utilization: {
            score: utilizationScore,
            details: {
                creditUtilization: 0,
                collateralHealth: onChainUtilization,
                balanceRatio: bankUtilization
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
