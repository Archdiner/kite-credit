import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { plaidClient } from "@/lib/plaid";
import { successResponse, errorResponse, rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    // Rate limit
    const ip = getClientIp(req);
    const { allowed } = rateLimit(ip);
    if (!allowed) {
        return rateLimitedResponse();
    }

    try {
        const { public_token } = await req.json();

        // Validate public_token is a non-empty string
        if (!public_token || typeof public_token !== "string" || public_token.trim().length === 0) {
            return errorResponse("Missing or invalid public_token", 400);
        }

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
