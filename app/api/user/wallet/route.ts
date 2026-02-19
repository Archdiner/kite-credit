// ---------------------------------------------------------------------------
// POST /api/user/wallet    — Add or update wallet
// GET  /api/user/wallet    — List wallets
// DELETE /api/user/wallet  — Remove a secondary wallet
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { getUserFromToken, extractAccessToken, upsertConnection, getConnection } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

export interface StoredWallet {
    address: string;
    chain: "solana";
    isPrimary: boolean;
    addedAt: string;
}

function parseWallets(conn: { metadata?: { wallets?: StoredWallet[] } } | null): StoredWallet[] {
    return conn?.metadata?.wallets ?? [];
}

export async function GET(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);
        if (!user) return errorResponse("Unauthorized", 401);

        const conn = await getConnection(user.id, "solana_wallet");
        return successResponse({ wallets: parseWallets(conn) });
    } catch (error) {
        console.error("[user/wallet] GET error:", error);
        return errorResponse("Failed to fetch wallets", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);
        if (!user) return errorResponse("Unauthorized", 401);

        const { walletAddress, chain = "solana" } = await request.json();

        if (!walletAddress || typeof walletAddress !== "string") {
            return errorResponse("Missing wallet address", 400);
        }

        if (chain !== "solana") {
            return errorResponse("Only Solana wallets are supported in this version", 400);
        }

        const conn = await getConnection(user.id, "solana_wallet");
        const existing = parseWallets(conn);

        if (existing.length >= 3) {
            return errorResponse("Maximum of 3 wallets allowed", 400);
        }

        const alreadyAdded = existing.find(w => w.address === walletAddress);
        if (alreadyAdded) {
            return successResponse({ wallets: existing, message: "Wallet already connected" });
        }

        const isPrimary = existing.length === 0;
        const newWallet: StoredWallet = {
            address: walletAddress,
            chain: "solana",
            isPrimary,
            addedAt: new Date().toISOString(),
        };

        const wallets = [...existing, newWallet];
        const primaryAddress = wallets.find(w => w.isPrimary)?.address ?? walletAddress;

        await upsertConnection(user.id, "solana_wallet", primaryAddress, null, { wallets });

        return successResponse({ wallets });
    } catch (error) {
        console.error("[user/wallet] POST error:", error);
        return errorResponse("Failed to save wallet", 500);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);
        if (!user) return errorResponse("Unauthorized", 401);

        const { walletAddress } = await request.json();
        if (!walletAddress) return errorResponse("Missing wallet address", 400);

        const conn = await getConnection(user.id, "solana_wallet");
        const existing = parseWallets(conn);
        const target = existing.find(w => w.address === walletAddress);

        if (!target) return errorResponse("Wallet not found", 404);
        if (target.isPrimary) return errorResponse("Cannot remove primary wallet", 400);

        const wallets = existing.filter(w => w.address !== walletAddress);
        const primaryAddress = wallets.find(w => w.isPrimary)?.address ?? wallets[0]?.address ?? null;

        await upsertConnection(user.id, "solana_wallet", primaryAddress, null, { wallets });

        return successResponse({ wallets });
    } catch (error) {
        console.error("[user/wallet] DELETE error:", error);
        return errorResponse("Failed to remove wallet", 500);
    }
}
