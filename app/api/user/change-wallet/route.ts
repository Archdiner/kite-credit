import { NextRequest } from "next/server";
import { getUserFromToken, extractAccessToken, upsertConnection } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);
        if (!user) return errorResponse("Unauthorized", 401);

        const { walletAddress } = await request.json();

        if (!walletAddress || typeof walletAddress !== "string") {
            return errorResponse("Missing wallet address", 400);
        }

        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
            return errorResponse("Invalid Solana wallet address", 400);
        }

        const supabase = createServerSupabaseClient();
        const { data: existingConnections } = await supabase
            .from("user_connections")
            .select("user_id, provider_user_id, metadata")
            .eq("provider", "solana_wallet")
            .neq("user_id", user.id);

        if (existingConnections) {
            for (const conn of existingConnections) {
                if (conn.provider_user_id === walletAddress) {
                    return errorResponse("This wallet is already connected to another account.", 409);
                }
                const wallets = conn.metadata?.wallets;
                if (Array.isArray(wallets) && wallets.some((w: { address: string }) => w.address === walletAddress)) {
                    return errorResponse("This wallet is already connected to another account.", 409);
                }
            }
        }

        const newWallet = {
            address: walletAddress,
            chain: "solana" as const,
            isPrimary: true,
            addedAt: new Date().toISOString(),
        };

        await upsertConnection(user.id, "solana_wallet", walletAddress, null, {
            wallets: [newWallet],
        });

        return successResponse({ wallets: [newWallet], message: "Wallet changed successfully" });
    } catch (error) {
        console.error("[user/change-wallet] Error:", error);
        return errorResponse("Failed to change wallet", 500);
    }
}
