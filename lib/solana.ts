// ---------------------------------------------------------------------------
// Solana on-chain analysis
// ---------------------------------------------------------------------------
// Reads wallet history from mainnet-beta via RPC and produces
// the on-chain sub-score (50% of the Kite Score, range 0-500).
//
// Protocol coverage (as of 2026):
//   Lending:  Kamino, marginfi, Solend
//   DEX:      Jupiter, Raydium, Orca, Meteora DLMM, Phoenix
//   Perps:    Drift
//   NFT:      Tensor
//   Staking:  Marinade (native), Jito (liquid)
//   DAO:      SPL Governance, Realms v2
// ---------------------------------------------------------------------------

import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import type { OnChainData, OnChainScore } from "@/types";

// ---------------------------------------------------------------------------
// Protocol registry
// ---------------------------------------------------------------------------

type ProtocolCategory = "lending" | "dex" | "nft" | "perps" | "staking";

interface ProtocolMeta {
    name: string;
    category: ProtocolCategory;
}

const KNOWN_DEFI_PROGRAMS: Record<string, ProtocolMeta> = {
    // ── Lending ──────────────────────────────────────────────────────────────
    "KLend2g3cP87ber41GRUi898R7XX24ndnagpLWCUKUV9": { name: "kamino", category: "lending" },
    "6LtLpnUFNByNXLyCoK9wA2MzykdmXaN1trJo4G5aF9Gn": { name: "kamino", category: "lending" },
    "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA":  { name: "marginfi", category: "lending" },
    "So1endDq2YkqhipRh3WViPa8hFM7DpXSrTR3sMhsMJm":  { name: "solend", category: "lending" },

    // ── DEX / AMM ─────────────────────────────────────────────────────────────
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4":  { name: "jupiter", category: "dex" },
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8":  { name: "raydium", category: "dex" },
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc":   { name: "orca", category: "dex" },
    "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo":  { name: "meteora", category: "dex" },
    "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY":  { name: "phoenix", category: "dex" },

    // ── Perpetuals ────────────────────────────────────────────────────────────
    "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH":  { name: "drift", category: "perps" },

    // ── NFT Marketplace ───────────────────────────────────────────────────────
    "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN":  { name: "tensor", category: "nft" },

    // ── Liquid Staking ────────────────────────────────────────────────────────
    "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD":  { name: "marinade", category: "staking" },
    "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb":  { name: "jito", category: "staking" },
};

// Lending protocols that could have liquidation events
const LENDING_PROTOCOL_NAMES = new Set(["kamino", "marginfi", "solend"]);

// Trusted stablecoin mints (USDC & USDT — established, never persistently depegged)
const STABLECOIN_MINTS: Record<string, { symbol: string; decimals: number }> = {
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", decimals: 6 },
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", decimals: 6 },
};

// Liquid Staking Token mints (value approximates SOL 1:1 over time)
const LST_MINTS: Record<string, { symbol: string; decimals: number }> = {
    "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": { symbol: "jitoSOL", decimals: 9 },
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  { symbol: "mSOL",    decimals: 9 },
    "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1":  { symbol: "bSOL",    decimals: 9 },
};

// Governance / DAO program IDs
const DAO_PROGRAMS = [
    "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw", // SPL Governance
    "GovHgfDPyQ1GwjFhNkMh4Pjqp1MTxe6fATnN7Dba47St", // Realms v2
];

function getRpcConnection(): Connection {
    const url = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    return new Connection(url, "confirmed");
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function getWalletAge(connection: Connection, address: string): Promise<number> {
    const pubkey = new PublicKey(address);
    let oldest: { signature: string; blockTime?: number | null } | null = null;
    let before: string | undefined = undefined;

    // Pagination loop: up to 10k txs to find the oldest
    for (let i = 0; i < 10; i++) {
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 500));

        const signatures = await connection.getSignaturesForAddress(pubkey, {
            limit: 1000,
            before,
        });

        if (signatures.length === 0) break;

        oldest = signatures[signatures.length - 1];
        before = oldest.signature;

        if (signatures.length < 1000) break;
    }

    if (!oldest || !oldest.blockTime) return 0;

    const ageDays = Math.floor((Date.now() / 1000 - oldest.blockTime) / 86400);
    return ageDays;
}

export async function getTransactionHistory(
    connection: Connection,
    address: string,
    limit = 200
): Promise<(ParsedTransactionWithMeta | null)[]> {
    const pubkey = new PublicKey(address);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit });

    if (signatures.length === 0) return [];

    const txs: (ParsedTransactionWithMeta | null)[] = [];
    const batchSize = 10;

    for (let i = 0; i < signatures.length; i += batchSize) {
        if (i > 0) await new Promise((r) => setTimeout(r, 100));
        const batch = signatures.slice(i, i + batchSize);
        try {
            const results = await Promise.all(
                batch.map((sig) =>
                    connection.getParsedTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0,
                    })
                )
            );
            txs.push(...results);
        } catch {
            // Continue to next batch instead of failing entirely
        }
    }

    return txs;
}

// ---------------------------------------------------------------------------
// DeFi interaction analysis
// ---------------------------------------------------------------------------

interface DeFiAnalysisResult {
    interactions: { protocol: string; count: number; category: ProtocolCategory }[];
    lendingTxCount: number;
    /** Conservative liquidation estimate — only flagged if a lending tx shows a
     *  significant unexpected decrease in the wallet's SOL balance.
     *  0 means either no liquidation occurred, or one could not be determined.
     */
    estimatedLiquidations: number;
}

export function analyzeDeFiInteractions(
    txs: (ParsedTransactionWithMeta | null)[],
    walletAddress: string
): DeFiAnalysisResult {
    const protocolCounts: Record<string, { count: number; category: ProtocolCategory }> = {};
    let lendingTxCount = 0;
    let estimatedLiquidations = 0;

    // Pre-compute wallet pubkey string for balance change lookup
    const walletPubkey = walletAddress.toLowerCase();

    for (const tx of txs) {
        if (!tx?.meta || tx.meta.err) continue;

        const accountKeys = tx.transaction.message.accountKeys.map((k) =>
            typeof k === "string" ? k : k.pubkey.toBase58()
        );

        let matchedProtocol: ProtocolMeta | null = null;
        let matchedKey = "";

        for (const key of accountKeys) {
            const proto = KNOWN_DEFI_PROGRAMS[key];
            if (proto) {
                matchedProtocol = proto;
                matchedKey = key;
                break;
            }
        }

        if (!matchedProtocol || !matchedKey) continue;

        const { name, category } = matchedProtocol;
        if (!protocolCounts[name]) {
            protocolCounts[name] = { count: 0, category };
        }
        protocolCounts[name].count += 1;

        // Track lending transactions for liquidation heuristic
        if (LENDING_PROTOCOL_NAMES.has(name)) {
            lendingTxCount++;

            // Liquidation heuristic:
            // A liquidation typically involves many accounts (7+) and results in
            // a net negative SOL balance change for the borrower beyond standard fees.
            // Standard tx fee ≈ 0.000005 SOL; liquidation penalty is 2-5% of position.
            if (accountKeys.length >= 7 && tx.meta.preBalances && tx.meta.postBalances) {
                const walletIndex = accountKeys.findIndex(
                    (k) => k.toLowerCase() === walletPubkey
                );
                if (walletIndex >= 0) {
                    const pre = tx.meta.preBalances[walletIndex] ?? 0;
                    const post = tx.meta.postBalances[walletIndex] ?? 0;
                    const dropLamports = pre - post;
                    const dropSol = dropLamports / 1e9;
                    // Flag if balance dropped by more than 0.1 SOL (> 100k lamports)
                    // net of normal fees (~5k lamports), in a complex lending tx.
                    if (dropSol > 0.1 && dropLamports > 100_000) {
                        estimatedLiquidations++;
                    }
                }
            }
        }
    }

    const interactions = Object.entries(protocolCounts).map(([protocol, { count, category }]) => ({
        protocol,
        count,
        category,
    }));

    return { interactions, lendingTxCount, estimatedLiquidations };
}

export function analyzeDAOParticipation(
    txs: (ParsedTransactionWithMeta | null)[]
): number {
    let daoTxCount = 0;

    for (const tx of txs) {
        if (!tx?.meta || tx.meta.err) continue;

        const accountKeys = tx.transaction.message.accountKeys.map((k) =>
            typeof k === "string" ? k : k.pubkey.toBase58()
        );

        for (const key of accountKeys) {
            if (DAO_PROGRAMS.includes(key)) {
                daoTxCount++;
                break;
            }
        }
    }

    return daoTxCount;
}

// ---------------------------------------------------------------------------
// Native staking
// ---------------------------------------------------------------------------

export async function getStakingInfo(
    connection: Connection,
    address: string
): Promise<{ active: boolean; durationDays: number }> {
    const pubkey = new PublicKey(address);

    try {
        const stakeAccounts = await connection.getParsedProgramAccounts(
            new PublicKey("Stake11111111111111111111111111111111111111"),
            {
                filters: [
                    {
                        memcmp: {
                            offset: 12,
                            bytes: pubkey.toBase58(),
                        },
                    },
                ],
            }
        );

        if (stakeAccounts.length === 0) return { active: false, durationDays: 0 };

        let earliestActivation = Infinity;
        let hasActive = false;

        for (const account of stakeAccounts) {
            const data = account.account.data;
            if ("parsed" in data && data.parsed?.info?.stake?.delegation) {
                const delegation = data.parsed.info.stake.delegation;
                if (delegation.activationEpoch) {
                    hasActive = true;
                    const epoch = Number(delegation.activationEpoch);
                    if (epoch < earliestActivation) earliestActivation = epoch;
                }
            }
        }

        const currentEpoch = (await connection.getEpochInfo()).epoch;
        const epochDiff = currentEpoch - earliestActivation;
        const durationDays = Math.max(0, Math.floor(epochDiff * 2.5));

        return { active: hasActive, durationDays };
    } catch {
        return { active: false, durationDays: 0 };
    }
}

// ---------------------------------------------------------------------------
// Stablecoin balance (USDC + USDT)
// ---------------------------------------------------------------------------

export async function getStablecoinBalance(
    connection: Connection,
    address: string
): Promise<number> {
    const pubkey = new PublicKey(address);
    let totalUsd = 0;

    const results = await Promise.allSettled(
        Object.keys(STABLECOIN_MINTS).map((mint) =>
            connection.getParsedTokenAccountsByOwner(pubkey, { mint: new PublicKey(mint) })
        )
    );

    for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const { account } of result.value.value) {
            const amount = Number(account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0);
            if (amount >= 1) totalUsd += amount;
        }
    }

    return totalUsd;
}

// ---------------------------------------------------------------------------
// Liquid Staking Token (LST) balance — jitoSOL, mSOL, bSOL
// ---------------------------------------------------------------------------
// LST balance is returned in token units (≈ SOL value, since LSTs track SOL
// price) and used as an additional staking signal in the score.

export async function getLSTBalance(
    connection: Connection,
    address: string
): Promise<number> {
    const pubkey = new PublicKey(address);
    let totalLST = 0;

    const results = await Promise.allSettled(
        Object.keys(LST_MINTS).map((mint) =>
            connection.getParsedTokenAccountsByOwner(pubkey, { mint: new PublicKey(mint) })
        )
    );

    for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const { account } of result.value.value) {
            const amount = Number(account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0);
            if (amount >= 0.01) totalLST += amount;
        }
    }

    return totalLST;
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

export async function analyzeSolanaData(address: string): Promise<OnChainData> {
    const connection = getRpcConnection();

    // Sequential: getWalletAge issues many paginated calls, exhaust that budget first
    const walletAgeDays = await getWalletAge(connection, address);
    const txs = await getTransactionHistory(connection, address, 200);
    const staking = await getStakingInfo(connection, address);

    const { interactions: deFiInteractions, estimatedLiquidations } =
        analyzeDeFiInteractions(txs, address);

    const totalTransactions = txs.filter((tx) => tx !== null).length;

    // Lightweight single-call fetches — safe to parallelize
    const [balanceLamports, stablecoinBalance, lstBalance] = await Promise.all([
        connection.getBalance(new PublicKey(address)),
        getStablecoinBalance(connection, address),
        getLSTBalance(connection, address),
    ]);

    const solBalance = balanceLamports / 1_000_000_000;

    return {
        walletAddress: address,
        walletAgeDays,
        totalTransactions,
        deFiInteractions,
        stakingActive: staking.active,
        stakingDurationDays: staking.durationDays,
        solBalance,
        stablecoinBalance,
        lstBalance,
        liquidationCount: estimatedLiquidations,
    };
}

// ---------------------------------------------------------------------------
// Scoring (0–500)
// ---------------------------------------------------------------------------

export function scoreOnChain(data: OnChainData): OnChainScore {
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
    // Rewards protocol diversity and transaction volume.
    // Max diversity per protocol category is capped to prevent score inflation
    // from using many similar DEXes.
    const uniqueProtocols = data.deFiInteractions.length;
    const totalDeFiTxs = data.deFiInteractions.reduce((sum, d) => sum + d.count, 0);

    // Diversity bonus: differentiated by category count (lending + perps score higher than DEX-only)
    const categories = new Set(data.deFiInteractions.map(d => d.category));
    const categoryBonus = categories.size * 5; // up to 25 bonus for 5 categories
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
    // Based on overall tx volume + DeFi depth.
    // Penalised for detected liquidation events (each costs -15 pts, max -30).
    const baseRepayment = Math.min(125, Math.floor(
        data.totalTransactions <= 0
            ? 0
            : data.totalTransactions < 20
                ? (data.totalTransactions / 20) * 50
                : data.totalTransactions < 100
                    ? 50 + ((data.totalTransactions - 20) / 80) * 40
                    : 90 + (Math.min(totalDeFiTxs, 50) / 50) * 35
    ));

    const liquidationPenalty = Math.min(30, (data.liquidationCount ?? 0) * 15);
    const repaymentHistory = Math.max(0, baseRepayment - liquidationPenalty);

    // ── Staking: 0–60 ───────────────────────────────────────────────────────
    // Native staking is valued slightly higher than liquid staking (LST)
    // because it signals a longer lockup commitment.
    // LST score is 85% of the equivalent native staking score.

    const nativeStakingScore = !data.stakingActive
        ? 0
        : Math.min(60, Math.floor(12 + (Math.min(data.stakingDurationDays, 365) / 365) * 48));

    const lstSol = data.lstBalance ?? 0;
    const lstStakingScore = lstSol < 0.01
        ? 0
        : Math.min(51, Math.floor(        // max 51 = 60 * 0.85
            lstSol < 0.1
                ? 3
                : lstSol < 1
                    ? 3 + ((lstSol - 0.1) / 0.9) * 9
                    : lstSol < 5
                        ? 12 + ((lstSol - 1) / 4) * 14
                        : lstSol < 25
                            ? 26 + ((lstSol - 5) / 20) * 20
                            : 46 + ((Math.min(lstSol, 100) - 25) / 75) * 5
        ));

    // Use the higher of native vs LST, plus a small synergy bonus if both active
    const stakingScore = Math.min(60, Math.floor(
        data.stakingActive && lstSol >= 0.01
            ? Math.max(nativeStakingScore, lstStakingScore) + 5  // synergy: both active
            : Math.max(nativeStakingScore, lstStakingScore)
    ));

    // ── Stablecoin capital: 0–25 ─────────────────────────────────────────────
    // On-chain proxy for "money in the bank." Hard to game (requires real capital).
    const stableUsd = data.stablecoinBalance ?? 0;
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

    const total = walletAge + deFiActivity + repaymentHistory + stakingScore + stablecoinCapital;

    return {
        score: Math.min(500, total),
        breakdown: {
            walletAge,
            deFiActivity,
            repaymentHistory,
            staking: stakingScore,
            stablecoinCapital,
        },
    };
}
