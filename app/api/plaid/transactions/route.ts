import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";

export async function POST(req: NextRequest) {
    try {
        const { access_token } = await req.json();

        // Fetch accounts (balance)
        const accountsResponse = await plaidClient.accountsGet({
            access_token,
        });

        // Fetch transactions (last 30 days)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const transactionsResponse = await plaidClient.transactionsGet({
            access_token,
            start_date: thirtyDaysAgo.toISOString().split("T")[0],
            end_date: now.toISOString().split("T")[0],
        });

        return NextResponse.json({
            accounts: accountsResponse.data.accounts,
            transactions: transactionsResponse.data.transactions,
        });
    } catch (error) {
        console.error("Error fetching Plaid data:", error);
        return NextResponse.json({ error: "Failed to fetch financial data" }, { status: 500 });
    }
}
