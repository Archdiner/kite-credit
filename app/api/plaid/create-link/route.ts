import { NextRequest } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";
import { randomUUID } from "crypto";

import { rateLimit, rateLimitedResponse, getClientIp, successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        const { allowed } = rateLimit(ip);
        if (!allowed) {
            return rateLimitedResponse();
        }

        // TODO: Integrate real auth check here (e.g. session/cookie)
        // const session = await auth(); 
        // if (!session) return errorResponse("Unauthorized", 401);

        const { clientUserId } = await req.json();

        const request = {
            user: { client_user_id: clientUserId || randomUUID() },
            client_name: "Kite Credit",
            products: [Products.Auth, Products.Transactions],
            country_codes: [CountryCode.Us],
            language: "en",
        };

        const response = await plaidClient.linkTokenCreate(request);

        return successResponse({ link_token: response.data.link_token });
    } catch (error) {
        console.error("Error creating link token:", error);
        return errorResponse("Failed to create link token", 500);
    }
}
