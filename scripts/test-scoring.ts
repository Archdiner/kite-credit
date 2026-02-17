
import { assembleKiteScore } from "../lib/scoring";
import { OnChainScore, FinancialScore, GitHubScore } from "../types";

// Helper to create mock OnChainScore
const mockOnChain = (age: number, txs: number, score: number): OnChainScore => ({
    score,
    breakdown: {
        walletAge: age,
        deFiActivity: Math.min(190, txs * 2),
        repaymentHistory: Math.min(125, txs),
        staking: Math.min(60, txs / 2),
    }
});

// Helper to create mock FinancialScore
const mockFinancial = (verified: boolean, incomeBonus: number): FinancialScore => ({
    score: verified ? 300 + incomeBonus : 0,
    breakdown: {
        balanceHealth: verified ? 150 : 0,
        incomeConsistency: verified ? incomeBonus : 0,
        verificationBonus: verified ? 85 : 0,
    },
    verified
});

const personas = [
    {
        name: "TradFi Native (Student)",
        onChain: mockOnChain(1, 0, 50), // 1 day old, 0 tx, low score
        financial: mockFinancial(true, 160), // Verified, High consistency
        expectedTier: "Strong"
    },
    {
        name: "DeFi Native (Degen)",
        onChain: mockOnChain(365, 100, 450), // 1 year old, 100 tx, high score
        financial: null, // Not connected
        expectedTier: "Strong"
    },
    {
        name: "Hybrid (Balanced)",
        onChain: mockOnChain(180, 50, 300), // 6 months, 50 tx
        financial: mockFinancial(true, 100), // Verified, Mid consistency
        expectedTier: "Strong"
    },
    {
        name: "Ghost (Newcomer)",
        onChain: mockOnChain(1, 0, 50),
        financial: null,
        expectedTier: "Building"
    },
    {
        name: "Gamer (Spammer)",
        onChain: mockOnChain(1, 100, 200), // 1 day old, but 100 tx (spam)
        financial: null,
        expectedTier: "Building" // Should be penalized by age
    }
];

console.log("----------------------------------------------------------------");
console.log("Kite Credit Scoring Simulation (Dynamic Weighting)");
console.log("----------------------------------------------------------------");

personas.forEach(p => {
    const result = assembleKiteScore({
        onChain: p.onChain,
        financial: p.financial,
        github: null
    }, "Test Simulation");

    const onChainW = (result.weights?.onChain ?? 0).toFixed(2);
    const finW = (result.weights?.financial ?? 0).toFixed(2);

    console.log(`\nPersona: ${p.name}`);
    console.log(`Weights -> OnChain: ${onChainW} | Financial: ${finW}`);
    console.log(`Score: ${result.total} (${result.tier})`);

    // Simple Assertion
    const passed = (p.expectedTier === "Strong" && result.total >= 700) ||
        (p.expectedTier === "Building" && result.total < 600) ||
        (p.expectedTier === result.tier); // Fallback exact match

    console.log(`Test Status: ${passed ? "✅ PASS" : "❌ FAIL"}`);
});
console.log("\n----------------------------------------------------------------");
