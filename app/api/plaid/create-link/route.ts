import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST(req: NextRequest) {
    try {
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
