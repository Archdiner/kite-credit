import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { plaidClient } from "@/lib/plaid";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    try {
        const { public_token } = await req.json();

        const response = await plaidClient.itemPublicTokenExchange({
            public_token,
        });

        const accessToken = response.data.access_token;

        // Store in HTTP-only cookie
        const cookieStore = await cookies();
        cookieStore.set("plaid_access_token", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        return successResponse({ access_token_set: true });
    } catch (error) {
        console.error("Error exchanging public token:", error);
        return errorResponse("Failed to exchange token", 500);
    }
}
