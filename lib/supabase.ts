// ---------------------------------------------------------------------------
// Supabase Client Configuration
// ---------------------------------------------------------------------------
// Browser client (anon key) and server client (service role for admin ops).
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Browser client (singleton) — used in React components
// ---------------------------------------------------------------------------

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
    if (browserClient) return browserClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
    }

    browserClient = createClient(url, publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });

    return browserClient;
}

// ---------------------------------------------------------------------------
// Server client — used in API routes (service role for admin operations)
// ---------------------------------------------------------------------------

export function createServerSupabaseClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const privateKey = process.env.SUPABASE_PRIVATE_KEY;

    if (!url || !privateKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_PRIVATE_KEY");
    }

    return createClient(url, privateKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// ---------------------------------------------------------------------------
// Server client with user context — for RLS-respecting queries
// ---------------------------------------------------------------------------

export function createServerSupabaseClientWithAuth(accessToken: string): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
    }

    return createClient(url, publishableKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
