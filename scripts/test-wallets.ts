import { analyzeSolanaData, scoreOnChain } from "../lib/solana";

const KNOWN_WALLETS = {
    // A known active wallet with DeFi history
    ACTIVE_WALLET: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    // A known passive/newer wallet (fixed invalid address)
    NEWER_WALLET: "7zKqH1zNWqT4eHn9D8xZ2GvBfQ2aJ6R9W7sK5cR4n",
    // Testing the system wallet
    SYSTEM_TX_WALLET: "11111111111111111111111111111111"
};

async function testWallet(name: string, address: string) {
    console.log(`\n=== Testing Wallet: ${name} (${address}) ===`);
    try {
        const data = await analyzeSolanaData(address);
        // console.log("Raw Data:", JSON.stringify(data, null, 2));

        const scoreData = scoreOnChain(data);
        console.log("Score Data:", JSON.stringify(scoreData, null, 2));

        console.log(`✅ Success for ${name}. Total On-Chain Score: ${scoreData.score}`);
    } catch (error) {
        console.error(`❌ Failed for ${name}:`, error);
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runAll() {
    console.log("Starting Real Wallet Verification...");
    for (const [name, address] of Object.entries(KNOWN_WALLETS)) {
        await testWallet(name, address);
        console.log("Waiting 2s to respect RPC rate limits...");
        await sleep(2000);
    }
    console.log("\nFinished Verification.");
}

runAll().catch(console.error);
