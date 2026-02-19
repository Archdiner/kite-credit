import { NextRequest } from "next/server";
import { getUserFromToken, extractAccessToken, upsertConnection, isWalletTakenByOtherUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

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

        if (await isWalletTakenByOtherUser(walletAddress, user.id)) {
            return errorResponse("This wallet is already associated with another account. Please try a different wallet.", 409);
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
