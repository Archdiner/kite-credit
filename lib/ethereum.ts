// ---------------------------------------------------------------------------
// Ethereum on-chain analysis (EVM)
// ---------------------------------------------------------------------------
// Reads wallet data from an Ethereum mainnet RPC and produces an EVMScore
// (0–500) mirroring the structure of lib/solana.ts.
//
// Returns null immediately if ETHEREUM_RPC_URL is not set — callers should
// treat a null result as "Ethereum not configured" and skip gracefully.
//
// Protocol coverage:
//   Lending:  Aave V3, Aave V2, Compound V3
//   DEX:      Uniswap V3
//   Staking:  Lido (stETH), Rocket Pool (rETH), Coinbase (cbETH)
// ---------------------------------------------------------------------------

import { createPublicClient, http, parseAbi, type Hex, type Address } from "viem";
import { mainnet } from "viem/chains";
import type { EVMData, EVMScore } from "@/types";

// ---------------------------------------------------------------------------
// Mainnet contract addresses
// ---------------------------------------------------------------------------

const AAVE_V3   = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as Address;
const AAVE_V2   = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9" as Address;
const COMPOUND_V3_USDC = "0xc3d688B66703497DAA19211EEdff47f25384cdc3" as Address;
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564" as Address;
const LIDO_STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address;

const USDC  = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
const USDT  = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address;
const RETH  = "0xae78736Cd615f374D3085123A210448E74Fc6393" as Address;
const CBETH = "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704" as Address;

// ---------------------------------------------------------------------------
// ABI fragments
// ---------------------------------------------------------------------------

const ERC20_BALANCE_ABI = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
]);

// Aave V3 event signatures (topic[0])
// Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount, bool useATokens)
const AAVE_V3_REPAY_TOPIC =
    "0xa534c8dbe71f871f9f3aecd28b6b5f77b8f1ddc33cfa85a2ec2aab9d39b79f61" as Hex;
// LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, ...)
const AAVE_V3_LIQUIDATION_TOPIC =
    "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286" as Hex;

// ---------------------------------------------------------------------------
// Client factory — returns null if RPC URL not configured
// ---------------------------------------------------------------------------

function getClient() {
    const rpcUrl = process.env.ETHEREUM_RPC_URL;
    if (!rpcUrl) return null;
    return createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
}

// ---------------------------------------------------------------------------
// Wallet age via binary block search on transaction count
// ---------------------------------------------------------------------------

async function getWalletAgeDays(
    client: ReturnType<typeof createPublicClient>,
    address: Address
): Promise<number> {
    try {
        const latestBlock = await client.getBlock({ blockTag: "latest" });
        const latestBlockNumber = latestBlock.number;
        const latestTimestamp = Number(latestBlock.timestamp);

        // Find the first block where the nonce (outgoing tx count) > 0
        // Binary search between block 0 and latest
        let lo = 0n;
        let hi = latestBlockNumber;
        let firstActiveBlock = 0n;

        const latestNonce = await client.getTransactionCount({ address, blockNumber: latestBlockNumber });
        if (latestNonce === 0) return 0; // Never sent a tx

        // Binary search for the block where nonce became 1
        while (lo < hi) {
            const mid = (lo + hi) / 2n;
            const nonce = await client.getTransactionCount({ address, blockNumber: mid });
            if (nonce === 0) {
                lo = mid + 1n;
            } else {
                firstActiveBlock = mid;
                hi = mid;
            }
        }

        if (firstActiveBlock === 0n) return 0;

        const firstBlock = await client.getBlock({ blockNumber: firstActiveBlock });
        const firstTimestamp = Number(firstBlock.timestamp);
        const ageDays = Math.floor((latestTimestamp - firstTimestamp) / 86400);
        return Math.max(0, ageDays);
    } catch {
        return 0;
    }
}

// ---------------------------------------------------------------------------
// ERC-20 balance helper
// ---------------------------------------------------------------------------

async function getTokenBalance(
    client: ReturnType<typeof createPublicClient>,
    token: Address,
    owner: Address,
    decimals: number
): Promise<number> {
    try {
        const raw = await client.readContract({
            address: token,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [owner],
        });
        return Number(raw) / 10 ** decimals;
    } catch {
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Log-based event counts
// ---------------------------------------------------------------------------

async function getAaveRepayCount(
    client: ReturnType<typeof createPublicClient>,
    address: Address
): Promise<number> {
    try {
        // Aave V3 Repay: user is indexed topic[2] (0=reserve, 1=user, 2=repayer)
        // We check topic[2] (repayer = the wallet repaying its own debt)
        const paddedAddress = ("0x" + address.slice(2).padStart(64, "0")) as Hex;
        const logs = await client.getLogs({
            address: AAVE_V3,
            topics: [AAVE_V3_REPAY_TOPIC, null, paddedAddress],
            fromBlock: 0n,
            toBlock: "latest",
        });
        return logs.length;
    } catch {
        return 0;
    }
}

async function getAaveLiquidationCount(
    client: ReturnType<typeof createPublicClient>,
    address: Address
): Promise<number> {
    try {
        // LiquidationCall: user is indexed topic[3]
        const paddedAddress = ("0x" + address.slice(2).padStart(64, "0")) as Hex;
        const logs = await client.getLogs({
            address: AAVE_V3,
            topics: [AAVE_V3_LIQUIDATION_TOPIC, null, null, paddedAddress],
            fromBlock: 0n,
            toBlock: "latest",
        });
        return logs.length;
    } catch {
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Protocol activity detection via getLogs (Transfer events to/from address)
// ---------------------------------------------------------------------------

// ERC-20 Transfer topic
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as Hex;

async function countProtocolInteractions(
    client: ReturnType<typeof createPublicClient>,
    address: Address,
    protocolAddress: Address
): Promise<number> {
    try {
        // Count Transfer events from the protocol contract to the user (received tokens)
        // This is a proxy for protocol interaction depth
        const paddedAddress = ("0x" + address.slice(2).padStart(64, "0")) as Hex;
        const logs = await client.getLogs({
            address: protocolAddress,
            topics: [TRANSFER_TOPIC, null, paddedAddress],
            fromBlock: 0n,
            toBlock: "latest",
        });
        return logs.length;
    } catch {
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

export async function analyzeEthereumData(address: string): Promise<EVMData | null> {
    const client = getClient();
    if (!client) return null;

    const addr = address as Address;

    try {
        // Fetch in parallel where possible
        const [
            walletAgeDays,
            txCount,
            ethBalanceWei,
            usdcBalance,
            usdtBalance,
            stethBalance,
            rethBalance,
            cbethBalance,
            lendingRepayments,
            liquidationCount,
        ] = await Promise.all([
            getWalletAgeDays(client, addr),
            client.getTransactionCount({ address: addr }).catch(() => 0),
            client.getBalance({ address: addr }).catch(() => 0n),
            getTokenBalance(client, USDC, addr, 6),
            getTokenBalance(client, USDT, addr, 6),
            getTokenBalance(client, LIDO_STETH, addr, 18),
            getTokenBalance(client, RETH, addr, 18),
            getTokenBalance(client, CBETH, addr, 18),
            getAaveRepayCount(client, addr),
            getAaveLiquidationCount(client, addr),
        ]);

        // DeFi interaction counts — parallel log queries
        const [aaveV3Count, aaveV2Count, compoundCount, uniswapCount, lidoCount] = await Promise.all([
            countProtocolInteractions(client, addr, AAVE_V3),
            countProtocolInteractions(client, addr, AAVE_V2),
            countProtocolInteractions(client, addr, COMPOUND_V3_USDC),
            countProtocolInteractions(client, addr, UNISWAP_V3_ROUTER),
            countProtocolInteractions(client, addr, LIDO_STETH),
        ]);

        const deFiInteractions: EVMData["deFiInteractions"] = [];
        if (aaveV3Count > 0) deFiInteractions.push({ protocol: "aave_v3", count: aaveV3Count, category: "lending" });
        if (aaveV2Count > 0) deFiInteractions.push({ protocol: "aave_v2", count: aaveV2Count, category: "lending" });
        if (compoundCount > 0) deFiInteractions.push({ protocol: "compound_v3", count: compoundCount, category: "lending" });
        if (uniswapCount > 0) deFiInteractions.push({ protocol: "uniswap_v3", count: uniswapCount, category: "dex" });
        if (lidoCount > 0) deFiInteractions.push({ protocol: "lido", count: lidoCount, category: "staking" });

        const ethBalance = Number(ethBalanceWei) / 1e18;
        const stablecoinBalance = usdcBalance + usdtBalance;
        const stakingBalance = stethBalance + rethBalance + cbethBalance;

        return {
            chain: "ethereum",
            walletAddress: address.toLowerCase(),
            walletAgeDays,
            totalTransactions: txCount,
            deFiInteractions,
            lendingRepayments,
            liquidationCount,
            ethBalance,
            stablecoinBalance,
            stakingBalance,
        };
    } catch (err) {
        console.error("[ethereum] analyzeEthereumData failed:", err);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Scoring (0–500) — mirrors scoreOnChain() structure from lib/solana.ts
// ---------------------------------------------------------------------------

export function scoreEVM(data: EVMData): EVMScore {
    // ── Wallet age: 0–125 ─────────────────────────────────────────────────────
    const walletAge = Math.min(125, Math.floor(
        data.walletAgeDays <= 0
            ? 0
            : data.walletAgeDays < 30
                ? (data.walletAgeDays / 30) * 30
                : data.walletAgeDays < 180
                    ? 30 + ((data.walletAgeDays - 30) / 150) * 45
                    : 75 + ((Math.min(data.walletAgeDays, 730) - 180) / 550) * 50
    ));

    // ── DeFi activity: 0–165 ─────────────────────────────────────────────────
    const uniqueProtocols = data.deFiInteractions.length;
    const totalDeFiTxs = data.deFiInteractions.reduce((sum, d) => sum + d.count, 0);

    const categories = new Set(data.deFiInteractions.map(d => d.category));
    const categoryBonus = categories.size * 5;
    const protocolDiversity = Math.min(55, uniqueProtocols * 12 + categoryBonus);

    const deFiVolume = Math.min(110, Math.floor(
        totalDeFiTxs <= 0
            ? 0
            : totalDeFiTxs < 10
                ? (totalDeFiTxs / 10) * 35
                : totalDeFiTxs < 50
                    ? 35 + ((totalDeFiTxs - 10) / 40) * 45
                    : 80 + ((Math.min(totalDeFiTxs, 200) - 50) / 150) * 30
    ));

    const deFiActivity = Math.min(165, Math.floor(protocolDiversity + deFiVolume));

    // ── Repayment history: 0–125 ─────────────────────────────────────────────
    // Use explicit lendingRepayments count (Aave V3 Repay events)
    const baseRepayment = Math.min(125, Math.floor(data.lendingRepayments * 8));
    const liquidationPenalty = Math.min(30, data.liquidationCount * 15);
    const repaymentHistory = Math.max(0, baseRepayment - liquidationPenalty);

    // ── Staking: 0–60 ────────────────────────────────────────────────────────
    // stakingBalance is stETH + rETH + cbETH in ETH-denominated value
    const staking = Math.min(60, Math.floor(
        data.stakingBalance < 0.01
            ? 0
            : data.stakingBalance < 0.1
                ? 3
                : data.stakingBalance < 1
                    ? 3 + ((data.stakingBalance - 0.1) / 0.9) * 9
                    : data.stakingBalance < 5
                        ? 12 + ((data.stakingBalance - 1) / 4) * 14
                        : data.stakingBalance < 25
                            ? 26 + ((data.stakingBalance - 5) / 20) * 20
                            : 46 + ((Math.min(data.stakingBalance, 100) - 25) / 75) * 14
    ));

    // ── Stablecoin capital: 0–25 ─────────────────────────────────────────────
    const stableUsd = data.stablecoinBalance;
    const stablecoinCapital = Math.min(25, Math.floor(
        stableUsd < 1
            ? 0
            : stableUsd < 100
                ? (stableUsd / 100) * 5
                : stableUsd < 1000
                    ? 5 + ((stableUsd - 100) / 900) * 7
                    : stableUsd < 10000
                        ? 12 + ((stableUsd - 1000) / 9000) * 8
                        : 20 + ((Math.min(stableUsd, 50000) - 10000) / 40000) * 5
    ));

    const total = walletAge + deFiActivity + repaymentHistory + staking + stablecoinCapital;

    return {
        score: Math.min(500, total),
        breakdown: {
            walletAge,
            deFiActivity,
            repaymentHistory,
            staking,
            stablecoinCapital,
        },
    };
}
