// ---------------------------------------------------------------------------
// Gemini 2.0 Flash -- Score Explanation
// ---------------------------------------------------------------------------
// Generates a human-readable explanation of the Kite Score using
// Google's Gemini API. The output is 2-3 direct sentences plus one
// actionable suggestion.
// ---------------------------------------------------------------------------

import type { ScoreBreakdown, ScoreTier } from "@/types";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface ExplanationInput {
    total: number;
    tier: ScoreTier;
    breakdown: ScoreBreakdown;
    connectedSources: string[];
}

export async function generateScoreExplanation(input: ExplanationInput): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return buildFallbackExplanation(input);
    }

    const prompt = buildPrompt(input);

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 200,
                    topP: 0.9,
                },
                systemInstruction: {
                    parts: [
                        {
                            text: `You are the Kite Credit score advisor. You explain credit scores in plain, direct language. No hype, no jargon, no exclamation marks, no emoji. Write like a thoughtful financial advisor speaking to someone they respect. Keep it to 2-3 sentences of explanation and one concrete suggestion for improvement. Never use phrases like "leverage", "cutting-edge", "harness the power of", or similar. Be specific about what drove the score.`,
                        },
                    ],
                },
            }),
        });

        if (!response.ok) {
            console.error("[gemini] API error:", response.status);
            return buildFallbackExplanation(input);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return buildFallbackExplanation(input);
        }

        return text.trim();
    } catch (err) {
        console.error("[gemini] Error:", err);
        return buildFallbackExplanation(input);
    }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(input: ExplanationInput): string {
    const parts: string[] = [
        `The user's Kite Score is ${input.total}/1000 (tier: ${input.tier}).`,
        `Connected sources: ${input.connectedSources.join(", ") || "none"}.`,
    ];

    if (input.breakdown.onChain) {
        const b = input.breakdown.onChain.breakdown;
        parts.push(
            `On-chain score: ${input.breakdown.onChain.score}/400. ` +
            `Wallet age: ${b.walletAge}/100, DeFi activity: ${b.deFiActivity}/150, ` +
            `Repayment history: ${b.repaymentHistory}/100, Staking: ${b.staking}/50.`
        );
    }

    if (input.breakdown.github) {
        const b = input.breakdown.github.breakdown;
        parts.push(
            `Professional score: ${input.breakdown.github.score}/300. ` +
            `Account age: ${b.accountAge}/50, Repo portfolio: ${b.repoPortfolio}/75, ` +
            `Commit consistency: ${b.commitConsistency}/100, Community trust: ${b.communityTrust}/75.`
        );
    }

    if (input.breakdown.financial) {
        const b = input.breakdown.financial.breakdown;
        parts.push(
            `Financial score: ${input.breakdown.financial.score}/300. ` +
            `Balance health: ${b.balanceHealth}/150, Income consistency: ${b.incomeConsistency}/100, ` +
            `Verification bonus: ${b.verificationBonus}/50.`
        );
    }

    const missing: string[] = [];
    if (!input.breakdown.onChain) missing.push("Solana wallet");
    if (!input.breakdown.github) missing.push("GitHub");
    if (!input.breakdown.financial) missing.push("bank verification");
    if (missing.length > 0) {
        parts.push(`Not yet connected: ${missing.join(", ")}.`);
    }

    parts.push("Explain this score and give one suggestion to improve it.");

    return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Fallback explanation (when Gemini is unavailable)
// ---------------------------------------------------------------------------

function buildFallbackExplanation(input: ExplanationInput): string {
    const parts: string[] = [];

    parts.push(
        `Your Kite Score is ${input.total} out of 1000, placing you in the "${input.tier}" tier.`
    );

    if (input.breakdown.onChain) {
        parts.push(
            `Your on-chain activity contributed ${input.breakdown.onChain.score} points.`
        );
    }

    if (input.breakdown.github) {
        parts.push(
            `Your GitHub profile contributed ${input.breakdown.github.score} points.`
        );
    }

    if (input.breakdown.financial) {
        parts.push(
            `Your verified financial data contributed ${input.breakdown.financial.score} points.`
        );
    }

    const missing: string[] = [];
    if (!input.breakdown.onChain) missing.push("a Solana wallet");
    if (!input.breakdown.github) missing.push("your GitHub profile");
    if (!input.breakdown.financial) missing.push("bank verification");
    if (missing.length > 0) {
        parts.push(`Connect ${missing.join(" and ")} to improve your score.`);
    }

    return parts.join(" ");
}
