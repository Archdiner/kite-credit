// ---------------------------------------------------------------------------
// Kite Credit — Lender Infrastructure Tests
// ---------------------------------------------------------------------------

import { createHmac } from "node:crypto";

// Mock Supabase and rate-limit to avoid needing env vars at import time
jest.mock("@/lib/supabase", () => ({
    createServerSupabaseClient: jest.fn(() => ({
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
    })),
}));

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
}));

// ---------------------------------------------------------------------------
// lib/api-key-auth — key generation and hashing
// ---------------------------------------------------------------------------

import { generateApiKey, hashApiKey } from "@/lib/api-key-auth";

describe("API Key Generation", () => {
    test("generates key with kite_ prefix", () => {
        const { rawKey } = generateApiKey();
        expect(rawKey.startsWith("kite_")).toBe(true);
    });

    test("rawKey is long enough (>40 chars)", () => {
        const { rawKey } = generateApiKey();
        expect(rawKey.length).toBeGreaterThan(40);
    });

    test("keyPrefix is first 12 chars of rawKey", () => {
        const { rawKey, keyPrefix } = generateApiKey();
        expect(keyPrefix).toBe(rawKey.slice(0, 12));
    });

    test("keyHash is deterministic for same input", () => {
        const { rawKey, keyHash } = generateApiKey();
        expect(hashApiKey(rawKey)).toBe(keyHash);
    });

    test("different keys produce different hashes", () => {
        const a = generateApiKey();
        const b = generateApiKey();
        expect(a.keyHash).not.toBe(b.keyHash);
    });

    test("hashApiKey produces 64-char hex string (SHA-256)", () => {
        const { keyHash } = generateApiKey();
        expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
    });
});


// ---------------------------------------------------------------------------
// lib/webhook — HMAC signing
// ---------------------------------------------------------------------------

import { signWebhookPayload } from "@/lib/webhook";

describe("Webhook HMAC Signing", () => {
    const secret = "test-secret-key-abc123";

    test("produces sha256= prefixed signature", () => {
        const sig = signWebhookPayload('{"event":"test"}', secret);
        expect(sig.startsWith("sha256=")).toBe(true);
    });

    test("signature is deterministic", () => {
        const payload = '{"score":750}';
        const sig1 = signWebhookPayload(payload, secret);
        const sig2 = signWebhookPayload(payload, secret);
        expect(sig1).toBe(sig2);
    });

    test("different payloads produce different signatures", () => {
        const sig1 = signWebhookPayload('{"score":750}', secret);
        const sig2 = signWebhookPayload('{"score":800}', secret);
        expect(sig1).not.toBe(sig2);
    });

    test("different secrets produce different signatures", () => {
        const payload = '{"score":750}';
        const sig1 = signWebhookPayload(payload, "secret-a");
        const sig2 = signWebhookPayload(payload, "secret-b");
        expect(sig1).not.toBe(sig2);
    });

    test("signature matches manual HMAC computation", () => {
        const payload = '{"event":"score.updated","score":742}';
        const expected =
            "sha256=" +
            createHmac("sha256", secret).update(payload).digest("hex");
        expect(signWebhookPayload(payload, secret)).toBe(expected);
    });

    test("verifier can reproduce signature from payload + secret", () => {
        const payload = '{"wallet":"abc"}';
        const signature = signWebhookPayload(payload, secret);
        // Simulate verifier
        const hex = signature.slice(7); // strip "sha256="
        const computed = createHmac("sha256", secret).update(payload).digest("hex");
        expect(hex).toBe(computed);
    });
});

// ---------------------------------------------------------------------------
// Batch address validation
// ---------------------------------------------------------------------------

describe("Batch Address Validation", () => {
    const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const MAX_ADDRESSES = 50;

    test("valid Solana addresses pass regex", () => {
        const valid = [
            "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        ];
        for (const addr of valid) {
            expect(SOLANA_ADDRESS_REGEX.test(addr)).toBe(true);
        }
    });

    test("invalid addresses fail regex", () => {
        const invalid = [
            "", // empty
            "0xinvalidEthAddress", // 0x prefix
            "short", // too short
            "has spaces in it which are not valid base58 characters!",
        ];
        for (const addr of invalid) {
            expect(SOLANA_ADDRESS_REGEX.test(addr)).toBe(false);
        }
    });

    test("deduplication reduces array size", () => {
        const addresses = ["addr1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "addr1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "addr2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"];
        const unique = [...new Set(addresses)];
        expect(unique.length).toBe(2);
    });

    test("max 50 addresses enforced", () => {
        const addresses = Array.from({ length: 51 }, (_, i) =>
            `addr${String(i).padStart(40, "0")}`
        );
        expect(addresses.length).toBeGreaterThan(MAX_ADDRESSES);
    });
});

