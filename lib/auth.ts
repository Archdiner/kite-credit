// ---------------------------------------------------------------------------
// Auth & Encryption Helpers
// ---------------------------------------------------------------------------
// Session management, token encryption (AES-256-GCM), and auth guards.
// Server-only — never import in client components.
// ---------------------------------------------------------------------------

import { createServerSupabaseClient } from "./supabase";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/**
 * Get the current user session from a Supabase access token.
 * Returns null if no valid session.
 */
export async function getUserFromToken(accessToken: string | undefined | null) {
    if (!accessToken) return null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    const supabase = createClient(
        url!,
        publishableKey!,
        {
            global: {
                headers: { Authorization: `Bearer ${accessToken}` },
            },
            auth: { autoRefreshToken: false, persistSession: false },
        }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
}

/**
 * Extract the access token from request cookies or Authorization header.
 */
export function extractAccessToken(request: Request): string | null {
    // Check Authorization header first
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }

    // Check cookie
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
            const [key, ...val] = c.trim().split("=");
            return [key, val.join("=")];
        })
    );

    // Supabase stores tokens in sb-<project-ref>-auth-token cookie
    // But we'll also support our own cookie name
    return cookies["sb-access-token"] || null;
}

/**
 * Require authentication — returns user or throws.
 */
export async function requireAuth(request: Request) {
    const token = extractAccessToken(request);
    const user = await getUserFromToken(token);

    if (!user) {
        throw new Error("Unauthorized");
    }

    return { user, token: token! };
}

// ---------------------------------------------------------------------------
// Token Encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
    const key = process.env.DB_ENCRYPTION_KEY;
    if (!key) {
        throw new Error("Missing DB_ENCRYPTION_KEY environment variable");
    }
    return Buffer.from(key, "hex");
}

/**
 * Encrypt a plaintext token. Returns a string in format: iv:encrypted:tag (all hex).
 */
export function encryptToken(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
}

/**
 * Decrypt a token encrypted by encryptToken.
 */
export function decryptToken(encryptedStr: string): string {
    const key = getEncryptionKey();
    const parts = encryptedStr.split(":");

    if (parts.length !== 3) {
        throw new Error("Invalid encrypted token format");
    }

    const [ivHex, encrypted, tagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const adminClient = () => createServerSupabaseClient();

/**
 * Save or update a user connection in the database.
 */
export async function upsertConnection(
    userId: string,
    provider: string,
    providerUserId: string | null,
    accessToken: string | null = null,
    metadata: Record<string, unknown> = {}
) {
    const supabase = adminClient();

    const data: Record<string, unknown> = {
        user_id: userId,
        provider,
        provider_user_id: providerUserId,
        metadata,
        updated_at: new Date().toISOString(),
    };

    if (accessToken) {
        data.access_token_encrypted = encryptToken(accessToken);
    }

    const { error } = await supabase
        .from("user_connections")
        .upsert(data, { onConflict: "user_id,provider" });

    if (error) {
        console.error(`[auth] Failed to upsert connection ${provider}:`, error);
        throw error;
    }
}

/**
 * Get a user's connection for a given provider.
 */
export async function getConnection(userId: string, provider: string) {
    const supabase = adminClient();

    const { data, error } = await supabase
        .from("user_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", provider)
        .single();

    if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found (not a real error)
        console.error(`[auth] Failed to get connection ${provider}:`, error);
    }

    return data || null;
}

/**
 * Get all connections for a user.
 */
export async function getAllConnections(userId: string) {
    const supabase = adminClient();

    const { data, error } = await supabase
        .from("user_connections")
        .select("provider, provider_user_id, metadata, connected_at, updated_at")
        .eq("user_id", userId);

    if (error) {
        console.error("[auth] Failed to get connections:", error);
        return [];
    }

    return data || [];
}

/**
 * Save a score to the database.
 */
export async function saveScore(
    userId: string,
    score: {
        total: number;
        tier: string;
        breakdown: unknown;
        githubBonus: number;
        explanation: string;
    },
    attestation: unknown,
    sources: string[]
) {
    const supabase = adminClient();

    const { error } = await supabase.from("user_scores").insert({
        user_id: userId,
        total_score: score.total,
        tier: score.tier,
        breakdown: score.breakdown,
        github_bonus: score.githubBonus,
        explanation: score.explanation,
        attestation,
        sources,
    });

    if (error) {
        console.error("[auth] Failed to save score:", error);
        throw error;
    }
}

/**
 * Get the latest score for a user.
 */
export async function getLatestScore(userId: string) {
    const supabase = adminClient();

    const { data, error } = await supabase
        .from("user_scores")
        .select("*")
        .eq("user_id", userId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== "PGRST116") {
        console.error("[auth] Failed to get latest score:", error);
    }

    return data || null;
}
