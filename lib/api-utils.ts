// ---------------------------------------------------------------------------
// API route utilities
// ---------------------------------------------------------------------------
// Standardized response helpers, error handling, and rate limiting.
// Every API route should use these.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function successResponse<T>(data: T, status = 200): NextResponse {
    const body: ApiResponse<T> = { success: true, data };
    return NextResponse.json(body, { status });
}

export function errorResponse(message: string, status = 400): NextResponse {
    const body: ApiResponse<never> = { success: false, error: message };
    return NextResponse.json(body, { status });
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory token bucket)
// ---------------------------------------------------------------------------
// Not suitable for multi-instance production deployments, but correct for a
// single-process prototype. Swap for Redis-backed limiter later.
// ---------------------------------------------------------------------------

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

const RATE_LIMIT_MAX_TOKENS = 30;      // max requests in window
const RATE_LIMIT_REFILL_RATE = 10;     // tokens restored per second
const RATE_LIMIT_WINDOW_MS = 60_000;   // cleanup interval

// Periodic cleanup of stale buckets done lazily in rateLimit function to avoid
// serverless module-level interval leaks.
// const RATE_LIMIT_WINDOW_MS = 60_000; (kept for reference if needed, or inline)

export function rateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();

    // Lazy cleanup: occasionally prune stale buckets (e.g. 1% chance or every call)
    // For simplicity/performance in this context, we can just clean specific IP or
    // iterate if map gets too big. Since this is a prototype, we'll skip the loop
    // for now or implement a simple check.
    // 
    // Better implementation:
    if (buckets.size > 1000) { // Safety cap
        for (const [key, b] of buckets) {
            if (now - b.lastRefill > RATE_LIMIT_WINDOW_MS) {
                buckets.delete(key);
            }
        }
    }

    let bucket = buckets.get(ip);

    if (!bucket) {
        bucket = { tokens: RATE_LIMIT_MAX_TOKENS, lastRefill: now };
        buckets.set(ip, bucket);
    }

    // Refill tokens based on time elapsed
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
        RATE_LIMIT_MAX_TOKENS,
        bucket.tokens + elapsed * RATE_LIMIT_REFILL_RATE
    );
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
        return { allowed: false, remaining: 0 };
    }

    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
}

export function rateLimitedResponse(): NextResponse {
    return errorResponse("Rate limit exceeded. Try again in a moment.", 429);
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    // Fallback for local development
    return "127.0.0.1";
}
