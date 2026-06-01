import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { analyzeSolanaData, scoreOnChain } from "@/lib/solana";
import { analyzeEthereumData, scoreEVM } from "@/lib/ethereum";
import { fetchGitHubData, scoreGitHub } from "@/lib/github";
import { assembleKiteScore, getConnectedSources } from "@/lib/scoring";
import { generateAttestation } from "@/lib/attestation";
import { decryptToken, saveScore } from "@/lib/auth";
import { dispatchScoreChanged } from "@/lib/webhook";

export async function GET(req: Request) {
    // 1. Validate Cron Secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    // 2. Find Stale Scores (older than 30 days)
    // We limit to 5 per run to avoid hitting Solana/Ethereum/Plaid RPC rate limits
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleScores, error } = await supabase
        .from("user_scores")
        .select("user_id, wallet_address")
        .lt("calculated_at", thirtyDaysAgo)
        .order("calculated_at", { ascending: true })
        .limit(5);

    if (error || !staleScores || staleScores.length === 0) {
        return NextResponse.json({ message: "No stale scores found or db error.", error });
    }

    const results = [];

    // 3. Re-score each stale profile
    for (const stale of staleScores) {
        const userId = stale.user_id;
        const walletAddress = stale.wallet_address;

        try {
            // A. Solana (Primary Wallet)
            const onChainData = await analyzeSolanaData(walletAddress);
            const onChainScore = scoreOnChain(onChainData);

            // Fetch secondary connections
            const { data: connections } = await supabase
                .from("user_connections")
                .select("*")
                .eq("user_id", userId);

            let evmScore = null;
            let githubScore = null;
            const financialScore = null;
            let secondaryWalletCount = 0;

            if (connections) {
                // B. Ethereum
                const ethConn = connections.find(c => c.provider === "ethereum_wallet");
                if (ethConn?.provider_user_id) {
                    try {
                        const ethData = await analyzeEthereumData(ethConn.provider_user_id);
                        if (ethData) {
                            evmScore = scoreEVM(ethData);
                            secondaryWalletCount++;
                        }
                    } catch (err) {
                        console.error(`[cron] EVM fail for ${userId}:`, err);
                    }
                }

                // C. GitHub
                const ghConn = connections.find(c => c.provider === "github");
                if (ghConn?.access_token_encrypted) {
                    try {
                        const ghToken = decryptToken(ghConn.access_token_encrypted);
                        const ghData = await fetchGitHubData(ghToken);
                        githubScore = scoreGitHub(ghData);
                        // Also update cache
                        await supabase
                            .from("user_connections")
                            .update({
                                metadata: { github_data: ghData, github_data_cached_at: new Date().toISOString() },
                            })
                            .eq("id", ghConn.id);
                    } catch (err) {
                        console.error(`[cron] GitHub fail for ${userId}:`, err);
                    }
                }

                // D. Plaid (Financial) - Removed
            }

            // 4. Assemble Score
            const kiteScore = assembleKiteScore({
                onChain: onChainScore,
                financial: financialScore,
                github: githubScore,
                ethereum: evmScore,
                secondaryWalletCount,
            }, "Score refreshed automatically by system.");

            // 5. Generate Verifiable Secp256k1 Attestation
            const attestation = await generateAttestation(kiteScore, walletAddress);

            // 6. Persist
            const sources = getConnectedSources(kiteScore.breakdown);
            if (evmScore) sources.push("ethereum_active");

            await saveScore(userId, kiteScore, attestation, sources);

            // 7. Fire Webhooks asynchronously
            dispatchScoreChanged(walletAddress, {
                score: kiteScore.total,
                tier: kiteScore.tier,
                issued_at: attestation.issued_at,
            }).catch((err) => console.error(`[cron] Webhook dispatch error for ${walletAddress}:`, err));

            results.push({ wallet: walletAddress, status: "success", newScore: kiteScore.total });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`[cron] Failed to refresh score for ${walletAddress}:`, err);
            results.push({ wallet: walletAddress, status: "error", error: errorMessage });
        }
    }

    return NextResponse.json({ success: true, refreshed: results.length, results });
}
