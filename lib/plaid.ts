// ---------------------------------------------------------------------------
// Plaid Client Configuration
// ---------------------------------------------------------------------------
// Initializing the Plaid client and defining types for our financial data.
// ---------------------------------------------------------------------------

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw new Error("Missing PLAID_CLIENT_ID or PLAID_SECRET environment variables");
}

const ALLOWED_PLAID_ENVS = ["sandbox", "development", "production"] as const;
const rawPlaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidEnv = ALLOWED_PLAID_ENVS.includes(rawPlaidEnv as typeof ALLOWED_PLAID_ENVS[number])
    ? rawPlaidEnv
    : (() => { console.warn(`[plaid] Invalid PLAID_ENV "${rawPlaidEnv}", falling back to "sandbox"`); return "sandbox"; })();

const configuration = new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
        headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
        },
    },
});

export const plaidClient = new PlaidApi(configuration);

// ---------------------------------------------------------------------------
// Constants And Types
// ---------------------------------------------------------------------------

// Standard 5-factor financial categorization for scoring
export interface PlaidFinancialData {
    accounts: Array<{
        name: string;
        type: string;
        subtype: string | null;
        balance_available: number | null;
        balance_current: number | null;
        limit: number | null; // For credit cards
    }>;
    transactions: Array<{
        amount: number;
        date: string;
        category: string[];
        name: string;
    }>;
    incomeStreams: Array<{
        amount: number;
        frequency: string;
    }>;
}

// Map parsed data into our scoring inputs
export interface ScoredFinancialData {
    balanceHealth: number; // 0-250 (max)
    flowHealth: number;    // 0-100 (income/expense ratio)
    consistency: number;   // 0-100 (regular salary etc)
    creditUtilization?: number; // 0-50 (if credit card present)
}
