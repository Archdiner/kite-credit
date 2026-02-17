import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

import { rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        const { allowed } = rateLimit(ip);
        if (!allowed) {
            return rateLimitedResponse();
        }

        // TODO: Integrate real auth check here (e.g. session/cookie)
        // const session = await auth(); 
        // if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { clientUserId } = await req.json();

        const request = {
            user: { client_user_id: clientUserId || "user-id" },
            client_name: "Kite Credit",
            products: [Products.Auth, Products.Transactions],
            country_codes: [CountryCode.Us],
            language: "en",
        };

        const response = await plaidClient.linkTokenCreate(request);

        return NextResponse.json({ link_token: response.data.link_token });
    } catch (error) {
        console.error("Error creating link token:", error);
        return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
    }
}
