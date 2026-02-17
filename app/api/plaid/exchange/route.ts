import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";

export async function POST(req: NextRequest) {
    try {
        const { public_token } = await req.json();

        const response = await plaidClient.itemPublicTokenExchange({
            public_token,
        });

        const accessToken = response.data.access_token;
        // In a real app, store accessToken securely in DB associated with user
        // For prototype, we'll return it to client layout (not recommended for prod)
        // or use a secure cookie session. Ideally, do analysis here and return score only.

        return NextResponse.json({ access_token: accessToken });
    } catch (error) {
        console.error("Error exchanging public token:", error);
        return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
    }
}
