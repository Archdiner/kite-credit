// ---------------------------------------------------------------------------
// Solana on-chain analysis
// ---------------------------------------------------------------------------
// Reads wallet history from mainnet-beta via QuickNode RPC and produces
// the on-chain sub-score (50% of the Kite Score, range 0-500).
// ---------------------------------------------------------------------------

import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import type { OnChainData, OnChainScore } from "@/types";

// Known DeFi program IDs on Solana
const KNOWN_DEFI_PROGRAMS: Record<string, string> = {
    // Kamino (lending/liquidity)
    "KLend2g3cP87ber41GRUi898R7XX24ndnagpLWCUKUV9": "kamino",
    "6LtLpnUFNByNXLyCoK9wA2MzykdmXaN1trJo4G5aF9Gn": "kamino",
    // Solend
    "So1endDq2YkqhipRh3WViPa8hFM7DpXSrTR3sMhsMJm": "solend",
    // Marinade
    "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD": "marinade",
    // Jupiter (aggregator)
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "jupiter",
    // Raydium
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "raydium",
    // Orca
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "orca",
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

    // Get the oldest signatures (limit 1, go as far back as possible)
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1000 });

    if (signatures.length === 0) return 0;

    // The last signature in the array is the oldest
    const oldest = signatures[signatures.length - 1];
    if (!oldest.blockTime) return 0;

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

    // Fetch in batches of 10 with delay to respect RPC rate limits
    const txs: (ParsedTransactionWithMeta | null)[] = [];
    const batchSize = 10;

    for (let i = 0; i < signatures.length; i += batchSize) {
        if (i > 0) await new Promise((r) => setTimeout(r, 100));
        const batch = signatures.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map((sig) =>
                connection.getParsedTransaction(sig.signature, {
                    maxSupportedTransactionVersion: 0,
                })
            )
        );
        txs.push(...results);
    }

    return txs;
}

export function analyzeDeFiInteractions(
    txs: (ParsedTransactionWithMeta | null)[]
): { protocol: string; count: number }[] {
    const protocolCounts: Record<string, number> = {};

    for (const tx of txs) {
        if (!tx?.meta || tx.meta.err) continue;

        const accountKeys = tx.transaction.message.accountKeys.map((k) =>
            typeof k === "string" ? k : k.pubkey.toBase58()
        );

        for (const key of accountKeys) {
            const protocol = KNOWN_DEFI_PROGRAMS[key];
            if (protocol) {
                protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
                break; // Count each tx once per protocol
            }
        }
    }

    return Object.entries(protocolCounts).map(([protocol, count]) => ({
        protocol,
        count,
    }));
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
                            offset: 12, // Authorized staker offset
                            bytes: pubkey.toBase58(),
                        },
                    },
                ],
            }
        );

        if (stakeAccounts.length === 0) {
            return { active: false, durationDays: 0 };
        }

        // Check if any stake is active and estimate duration
        let earliestActivation = Infinity;
        let hasActive = false;

        for (const account of stakeAccounts) {
            const data = account.account.data;
            if ("parsed" in data && data.parsed?.info?.stake?.delegation) {
                const delegation = data.parsed.info.stake.delegation;
                if (delegation.activationEpoch) {
                    hasActive = true;
                    const epoch = Number(delegation.activationEpoch);
                    if (epoch < earliestActivation) {
                        earliestActivation = epoch;
                    }
                }
            }
        }

        // Rough estimate: each Solana epoch is roughly 2-3 days
        const currentEpoch = (await connection.getEpochInfo()).epoch;
        const epochDiff = currentEpoch - earliestActivation;
        const durationDays = Math.max(0, Math.floor(epochDiff * 2.5));

        return { active: hasActive, durationDays };
    } catch {
        return { active: false, durationDays: 0 };
    }
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

export async function analyzeWallet(address: string): Promise<OnChainData> {
    const connection = getRpcConnection();

    const [walletAgeDays, txs, staking] = await Promise.all([
        getWalletAge(connection, address),
        getTransactionHistory(connection, address, 200),
        getStakingInfo(connection, address),
    ]);

    const deFiInteractions = analyzeDeFiInteractions(txs);
    const totalTransactions = txs.filter((tx) => tx !== null).length;

    return {
        walletAddress: address,
        walletAgeDays,
        totalTransactions,
        deFiInteractions,
        stakingActive: staking.active,
        stakingDurationDays: staking.durationDays,
    };
}

// ---------------------------------------------------------------------------
// Scoring (0-500)
// ---------------------------------------------------------------------------

export function scoreOnChain(data: OnChainData): OnChainScore {
    // Wallet age: 0-125
    // 0 days = 0, 30 days = 30, 180 days = 75, 365+ days = 125
    const walletAge = Math.min(125, Math.floor(
        data.walletAgeDays <= 0
            ? 0
            : data.walletAgeDays < 30
                ? (data.walletAgeDays / 30) * 30
                : data.walletAgeDays < 180
                    ? 30 + ((data.walletAgeDays - 30) / 150) * 45
                    : 75 + ((Math.min(data.walletAgeDays, 730) - 180) / 550) * 50
    ));

    // DeFi activity: 0-190
    // Number of unique protocols interacted with + volume of interactions
    const uniqueProtocols = data.deFiInteractions.length;
    const totalDeFiTxs = data.deFiInteractions.reduce((sum, d) => sum + d.count, 0);
    const protocolDiversity = Math.min(65, uniqueProtocols * 16); // max 4+ protocols = 64
    const deFiVolume = Math.min(125, Math.floor(
        totalDeFiTxs <= 0
            ? 0
            : totalDeFiTxs < 10
                ? (totalDeFiTxs / 10) * 40
                : totalDeFiTxs < 50
                    ? 40 + ((totalDeFiTxs - 10) / 40) * 50
                    : 90 + ((Math.min(totalDeFiTxs, 200) - 50) / 150) * 35
    ));
    const deFiActivity = Math.min(190, Math.floor(protocolDiversity + deFiVolume));

    // Repayment history: 0-125
    // For MVP, we approximate via successful DeFi tx ratio and general tx success
    const repaymentHistory = Math.min(125, Math.floor(
        data.totalTransactions <= 0
            ? 0
            : data.totalTransactions < 20
                ? (data.totalTransactions / 20) * 50
                : data.totalTransactions < 100
                    ? 50 + ((data.totalTransactions - 20) / 80) * 40
                    : 90 + (Math.min(totalDeFiTxs, 50) / 50) * 35
    ));

    // Staking: 0-60
    const stakingScore = !data.stakingActive
        ? 0
        : Math.min(60, Math.floor(
            12 + (Math.min(data.stakingDurationDays, 365) / 365) * 48
        ));

    const total = walletAge + deFiActivity + repaymentHistory + stakingScore;

    return {
        score: Math.min(500, total),
        breakdown: {
            walletAge,
            deFiActivity,
            repaymentHistory,
            staking: stakingScore,
        },
    };
}
