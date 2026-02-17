// ---------------------------------------------------------------------------
// Environment variable validation
// ---------------------------------------------------------------------------
// Fails fast at import time if required variables are missing.
// Server-only variables (no NEXT_PUBLIC_ prefix) are never exposed to the
// client bundle.
// ---------------------------------------------------------------------------

// Prevent accidental client-side import of server secrets
if (typeof window !== "undefined") {
    throw new Error("lib/env.ts should only be imported on the server");
}

interface EnvConfig {
    // Solana
    SOLANA_RPC_URL: string;

    // GitHub OAuth
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;

    // Gemini
    GEMINI_API_KEY: string;

    // Reclaim Protocol
    RECLAIM_APP_ID: string;
    RECLAIM_APP_SECRET: string;

    // App
    NEXT_PUBLIC_APP_URL: string;
}

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(
            `Missing required environment variable: ${key}. ` +
            `Copy .env.example to .env.local and fill in the values.`
        );
    }
    return value;
}

function getOptionalEnv(key: string, fallback: string): string {
    return process.env[key] || fallback;
}

// Lazy singleton so we only validate once per process lifetime.
let _env: EnvConfig | null = null;

export function getEnv(): EnvConfig {
    if (_env) return _env;

    _env = {
        SOLANA_RPC_URL: requireEnv("SOLANA_RPC_URL"),
        GITHUB_CLIENT_ID: requireEnv("GITHUB_CLIENT_ID"),
        GITHUB_CLIENT_SECRET: requireEnv("GITHUB_CLIENT_SECRET"),
        GEMINI_API_KEY: requireEnv("GEMINI_API_KEY"),
        RECLAIM_APP_ID: requireEnv("RECLAIM_APP_ID"),
        RECLAIM_APP_SECRET: requireEnv("RECLAIM_APP_SECRET"),
        NEXT_PUBLIC_APP_URL: getOptionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    };

    return _env;
}

// For early phases where not all keys are set yet, validate only what is needed.
export function requireKeys(...keys: (keyof EnvConfig)[]): Partial<EnvConfig> {
    const partial: Record<string, string> = {};
    for (const key of keys) {
        partial[key] = requireEnv(key);
    }
    return partial as Partial<EnvConfig>;
}

/**
 * Returns the app's base URL, auto-detecting Vercel deployments.
 * Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost fallback.
 */
export function getAppUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
}
