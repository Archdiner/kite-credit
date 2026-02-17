import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { Transaction } from "plaid";

export async function POST(req: NextRequest) {
    try {
        const { access_token } = await req.json();

        // Fetch accounts (balance)
        const accountsResponse = await plaidClient.accountsGet({
            access_token,
        });

        // Fetch transactions (last 30 days) with pagination
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let allTransactions: Transaction[] = [];
        let offset = 0;
        const count = 100; // max per page
        let hasMore = true;

        while (hasMore) {
            const response = await plaidClient.transactionsGet({
                access_token,
                start_date: thirtyDaysAgo.toISOString().split("T")[0],
                end_date: now.toISOString().split("T")[0],
                options: {
                    count,
                    offset,
                },
            });

            const transactions = response.data.transactions;
            const total = response.data.total_transactions;

            allTransactions = allTransactions.concat(transactions);

            if (transactions.length < count || allTransactions.length >= total) {
                hasMore = false;
            } else {
                offset += transactions.length;
            }
        }

        return successResponse({
            accounts: accountsResponse.data.accounts,
            transactions: allTransactions,
        });
    } catch (error) {
        console.error("Error fetching Plaid data:", error);
        return errorResponse("Failed to fetch financial data", 500);
    }
}
