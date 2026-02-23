// ---------------------------------------------------------------------------
// Lender API Key — Generation, Hashing & Authentication
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

const API_KEY_PREFIX = "kite_";

export interface LenderRecord {
    id: string;
    key_prefix: string;
    name: string | null;
    email: string | null;
    use_case: string | null;
    rate_limit: number;
    active: boolean;
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
    const raw = randomBytes(32).toString("base64url");
    const rawKey = `${API_KEY_PREFIX}${raw}`;
    return {
        rawKey,
        keyHash: hashApiKey(rawKey),
        keyPrefix: rawKey.slice(0, 12),
    };
}

export function hashApiKey(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Request authentication
// ---------------------------------------------------------------------------

export async function authenticateApiKey(req: NextRequest): Promise<LenderRecord | null> {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer kite_")) return null;

    const rawKey = auth.slice(7); // "Bearer ".length
    const keyHash = hashApiKey(rawKey);

    const supabase = createServerSupabaseClient();
    const { data } = await supabase
        .from("lender_api_keys")
        .select("id, key_prefix, name, email, use_case, rate_limit, active")
        .eq("key_hash", keyHash)
        .single();

    if (!data || !data.active) return null;
    return data as LenderRecord;
}

// ---------------------------------------------------------------------------
// Per-lender rate limiting
// ---------------------------------------------------------------------------

export function checkLenderRateLimit(lenderId: string, endpoint: string, limit?: number) {
    return checkRateLimit(`lender:${lenderId}:${endpoint}`, limit ?? 1000, 3600);
}
