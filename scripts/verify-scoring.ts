
import { Connection, PublicKey } from "@solana/web3.js";
import { scoreOnChain } from "../lib/solana";
import { assembleKiteScore } from "../lib/scoring";
import * as dotenv from "dotenv";

// Load env vars
dotenv.config({ path: ".env.local" });

// Mock data for deep analysis (to avoid 429s on public RPC)
const MOCK_ON_CHAIN_DATA = {
    walletAddress: "CuieVDEDtLo7FypA9SbFKueGaf2p5c6POkjiL2U8C2", // Solana Foundation Donation Address
    walletAgeDays: 1450, // Very old wallet
    totalTransactions: 5000,
    deFiInteractions: [
        { protocol: "jupiter", count: 120 },
        { protocol: "marinade", count: 45 },
        { protocol: "kamino", count: 12 }
    ],
    stakingActive: true,
    stakingDurationDays: 365,
    solBalance: 0
};

async function runVerification() {
    console.log("🔍 Starting E2E Scoring Verification (with mocked history for speed)...");

    // 1. Fetch Real Balance (Light RPC call)
    let realBalance = 0;
    try {
        const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
        const balanceLamports = await connection.getBalance(new PublicKey(MOCK_ON_CHAIN_DATA.walletAddress));
        realBalance = balanceLamports / 1000000000;
        console.log(`✅ Fetched Real Balance for ${MOCK_ON_CHAIN_DATA.walletAddress}: ${realBalance.toFixed(2)} SOL`);
    } catch (e) {
        console.warn("⚠️ Failed to fetch balance (RPC limit), using mock:", e);
        realBalance = 500.25;
    }

    // Combine mock data with real balance
    const onChainData = {
        ...MOCK_ON_CHAIN_DATA,
        solBalance: realBalance
    };

    console.log("\n📊 On-Chain Data (Simulated Deep Analysis):");
    console.log("   - Wallet Age:", onChainData.walletAgeDays, "days");
    console.log("   - Total Txs:", onChainData.totalTransactions);
    console.log("   - DeFi Interactions:", onChainData.deFiInteractions.length);
    console.log("   - Staking Active:", onChainData.stakingActive);
    console.log("   - SOL Balance:", onChainData.solBalance);

    // 2. Calculate Score (Wallet Only)
    console.log("\nBS Calculating Score (Wallet Only)...");
    const onChainScore = scoreOnChain(onChainData);

    // Simulate scoring assembly
    const kiteScore = assembleKiteScore({
        onChain: onChainScore,
        financial: null, // Simulate no bank
        github: null
    }, "Pending AI...");

    console.log(`   - Kite Score: ${kiteScore.total} (${kiteScore.tier})`);
    console.log("   - Breakdown:", JSON.stringify(kiteScore.breakdown.fiveFactor, null, 2));

    // 3. Generate AI Explanation
    console.log("\n🤖 Generating AI Explanation...");
    if (process.env.GEMINI_API_KEY) {
        try {
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const promptContext = `Wallet: ${onChainData.walletAddress} (Age: ${onChainData.walletAgeDays} days, DeFi interactions: ${onChainData.deFiInteractions.length}, Balance: ${onChainData.solBalance} SOL)\nFinancial: Not connected (User is relying on decentralized reputation only).\n`;

            const prompt = `Analyze this credit profile for a DeFi lending protocol.\n${promptContext}Provide a 2-sentence explanation of their creditworthiness based heavily on their on-chain behavior and consistency. Do not mention missing bank data negatively.`;

            console.log("   - Prompt sent to AI:", prompt.replace(/\n/g, " "));
            const result = await model.generateContent(prompt);
            console.log("   - AI Response:", result.response.text());
        } catch (e) {
            console.error("   - AI Generation Failed:", e);
        }
    } else {
        console.log("   - SKIPPED: GEMINI_API_KEY not found");
    }

    // 4. Calculate Score (Wallet + GitHub)
    console.log("\n🐙 Calculating Score (Wallet + GitHub Mock)...");
    const githubMock = {
        score: 250,
        breakdown: { accountAge: 35, repoPortfolio: 50, commitConsistency: 55, communityTrust: 40, codeQuality: 70 }
    };

    const kiteScoreWithGithub = assembleKiteScore({
        onChain: onChainScore,
        financial: null,
        github: githubMock
    }, "Pending AI...");

    console.log(`   - Kite Score (w/ GitHub): ${kiteScoreWithGithub.total} (${kiteScoreWithGithub.tier})`);
    console.log(`   - Bonus Points: +${kiteScoreWithGithub.githubBonus}`);
}

runVerification();
