import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client for server-side rate limiting
// We use the service role key (or private key) if available to bypass RLS, 
// ensuring we can always read/write rate limit data.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PRIVATE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials for rate limiting.");
}

const supabase = createClient(supabaseUrl!, supabaseKey!, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp in seconds
}

/**
 * Checks if a request exceeds the rate limit.
 * Implements a fixed window counter.
 * 
 * @param identifier Unique identifier for the user (e.g., IP address, User ID)
 * @param limit Max requests allowed in the window
 * @param windowSeconds Duration of the window in seconds
 * @returns RateLimitResult
 */
export async function checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    try {
        // 1. Get current usage
        const { data, error } = await supabase
            .from("rate_limits")
            .select("*")
            .eq("key", identifier)
            .single();

        if (error && error.code !== "PGRST116") { // PGRST116 is "Row not found"
            console.error("Rate limit check error:", error);
            // Fail open to avoid blocking legitimate users on DB error, 
            // or fail closed if security is paramount. Defaulting to fail open here.
            return { success: true, limit, remaining: 1, reset: Math.floor(now.getTime() / 1000) };
        }

        let currentCount = 0;
        let lastRequest = windowStart; // Assume old if not found

        if (data) {
            currentCount = data.count;
            lastRequest = new Date(data.last_request);
        }

        // 2. Check logic
        if (lastRequest < windowStart) {
            // Window expired, reset
            const { error: upsertError } = await supabase
                .from("rate_limits")
                .upsert({ key: identifier, count: 1, last_request: now.toISOString() });

            if (upsertError) console.error("Rate limit reset error:", upsertError);

            return {
                success: true,
                limit,
                remaining: limit - 1,
                reset: Math.floor(now.getTime() / 1000) + windowSeconds,
            };
        } else {
            // Within window
            if (currentCount >= limit) {
                // Rate limited
                return {
                    success: false,
                    limit,
                    remaining: 0,
                    reset: Math.floor(lastRequest.getTime() / 1000) + windowSeconds,
                };
            } else {
                // Increment
                const { error: incError } = await supabase
                    .from("rate_limits")
                    .update({ count: currentCount + 1, last_request: now.toISOString() }) // maintain last_request or update it? 
                    // Fixed window usually resets at fixed intervals. 
                    // Sliding window via "last_request < windowStart" logic acts like "reset if idle for window".
                    // To be strict simple window: 
                    // If we want "5 requests per minute starting from first request", we keep the original timestamp.
                    // BUT, to keep it simple and stateless-ish without storing "startTime", we can just use the last_request logic above.
                    // Let's stick to the logic: if (lastRequest < windowStart) reset.
                    // So if I make 5 requests rapidly, they all fall within `lastRequest >= windowStart` (if I update last_request).
                    // Wait, if I update `last_request` on every hit, I am extending the window? Yes, that becomes a sliding window where you must pause for `windowSeconds`.
                    // That is often MORE restrictive/annoying than fixed window.
                    // Better Fixed Window: Store `window_start`.
                    // Let's adjust:
                    // The table has `last_request`.
                    // If we use `last_request` as "Start of current window", we only update it when we reset.
                    // When we increment, we DON'T update `last_request`.
                    .eq("key", identifier);

                // However, my SQL update above *was* updating last_request.
                // Let's execute a slightly different logic to be friendlier/standard.

                // RE-READING Logic:
                // If I want a fixed window (e.g. 10:00 to 10:01):
                // Row: { key: "ip", count: 1, last_request: "10:00:05" }
                // Next req at 10:00:10. 10:00:05 is > (10:00:10 - 60s).
                // Increment count. Do NOT update last_request?
                // If I don't update last_request, it stays 10:00:05.
                // Req at 10:00:55. windowStart (at 10:00:55) is 09:59:55. 10:00:05 > 09:59:55. Count increments.
                // Req at 10:01:06. windowStart is 10:00:06. 10:00:05 < 10:00:06. RESET!
                // yes, this works as a "Fixed Window relative to first request".

                if (incError) console.error("Rate limit increment error:", incError);

                // We need to NOT update last_request in the else block if we want fixed window relative to first req.
                // But `upsert` in the "reset" block sets it to NOW.
                // So here we should only update count.
                await supabase
                    .from("rate_limits")
                    .update({ count: currentCount + 1 })
                    .eq("key", identifier);

                return {
                    success: true,
                    limit,
                    remaining: limit - (currentCount + 1),
                    reset: Math.floor(lastRequest.getTime() / 1000) + windowSeconds,
                };
            }
        }

    } catch (err) {
        console.error("Rate limit unexpected error:", err);
        return { success: true, limit, remaining: 1, reset: Math.floor(now.getTime() / 1000) };
    }
}
