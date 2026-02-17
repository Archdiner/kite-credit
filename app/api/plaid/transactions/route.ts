// ---------------------------------------------------------------------------
// POST /api/plaid/transactions
// ---------------------------------------------------------------------------
// Fetches account balances and recent transactions using the Plaid
// access token stored in an HTTP-only cookie.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { plaidClient } from "@/lib/plaid";
import { successResponse, errorResponse, rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";
import { Transaction } from "plaid";

export async function POST(req: NextRequest) {
    // Rate limit
    const ip = getClientIp(req);
    const { allowed } = rateLimit(ip);
    if (!allowed) return rateLimitedResponse();

    try {
        // Read access token from secure HTTP-only cookie (not request body)
        const cookieStore = await cookies();
        const accessToken = cookieStore.get("plaid_access_token")?.value;

        if (!accessToken) {
            return errorResponse("Bank account not connected. Please link via Plaid first.", 401);
        }

        // Fetch accounts (balance)
        const accountsResponse = await plaidClient.accountsGet({
            access_token: accessToken,
        });

        // Fetch transactions (last 30 days) with pagination
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let allTransactions: Transaction[] = [];
        let offset = 0;
        const count = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await plaidClient.transactionsGet({
                access_token: accessToken,
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
        console.error("[plaid/transactions] Error:", error);
        return errorResponse("Failed to fetch financial data", 500);
    }
}
