// ---------------------------------------------------------------------------
// Lender Infrastructure — Supabase Integration Tests
// ---------------------------------------------------------------------------
// These tests hit the real database. They are skipped automatically when
// SUPABASE_PRIVATE_KEY is not set (e.g. in CI without secrets configured).
//
// To run locally:
//   npm run test:integration
//
// All tests clean up their own rows in afterEach/afterAll.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateApiKey } from "@/lib/api-key-auth";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { dispatchWebhook } from "@/lib/webhook";

const INTEGRATION_ENABLED = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_PRIVATE_KEY
);

const describeIf = INTEGRATION_ENABLED ? describe : describe.skip;

// A real Solana mainnet address used as a stable test fixture
const TEST_WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

// ---------------------------------------------------------------------------
// API Key lifecycle
// ---------------------------------------------------------------------------

describeIf("API Key — DB lifecycle", () => {
    const createdIds: string[] = [];

    afterAll(async () => {
        if (createdIds.length === 0) return;
        const sb = createServerSupabaseClient();
        await sb.from("lender_api_keys").delete().in("id", createdIds);
    });

    async function insertKey(overrides: Record<string, unknown> = {}) {
        const { rawKey, keyHash, keyPrefix } = generateApiKey();
        const sb = createServerSupabaseClient();
        const { data, error } = await sb
            .from("lender_api_keys")
            .insert({ key_hash: keyHash, key_prefix: keyPrefix, name: "Integration Test", email: "test@example.com", ...overrides })
            .select("id")
            .single();
        if (error) throw error;
        createdIds.push(data!.id);
        return { rawKey, keyHash, keyPrefix, id: data!.id };
    }

    it("inserts an API key and retrieves it by hash", async () => {
        const { keyHash, keyPrefix } = await insertKey();
        const sb = createServerSupabaseClient();
        const { data } = await sb
            .from("lender_api_keys")
            .select("key_prefix, active, rate_limit")
            .eq("key_hash", keyHash)
            .single();

        expect(data).not.toBeNull();
        expect(data!.key_prefix).toBe(keyPrefix);
        expect(data!.active).toBe(true);
        expect(data!.rate_limit).toBe(1000);
    });

    it("authenticateApiKey returns lender for valid active key", async () => {
        const { rawKey, keyPrefix } = await insertKey();
        const req = new NextRequest("https://kitecredit.xyz/api/test", {
            headers: { Authorization: `Bearer ${rawKey}` },
        });

        const lender = await authenticateApiKey(req);
        expect(lender).not.toBeNull();
        expect(lender!.key_prefix).toBe(keyPrefix);
        expect(lender!.active).toBe(true);
    });

    it("authenticateApiKey returns null for an inactive key", async () => {
        const { rawKey } = await insertKey({ active: false });
        const req = new NextRequest("https://kitecredit.xyz/api/test", {
            headers: { Authorization: `Bearer ${rawKey}` },
        });

        const lender = await authenticateApiKey(req);
        expect(lender).toBeNull();
    });

    it("authenticateApiKey returns null for a nonexistent key", async () => {
        const { rawKey } = generateApiKey(); // never inserted
        const req = new NextRequest("https://kitecredit.xyz/api/test", {
            headers: { Authorization: `Bearer ${rawKey}` },
        });

        const lender = await authenticateApiKey(req);
        expect(lender).toBeNull();
    });

    it("authenticateApiKey returns null with no Authorization header", async () => {
        const req = new NextRequest("https://kitecredit.xyz/api/test");
        const lender = await authenticateApiKey(req);
        expect(lender).toBeNull();
    });

    it("key_hash uniqueness — duplicate insert is rejected", async () => {
        const { keyHash, keyPrefix } = generateApiKey();
        const sb = createServerSupabaseClient();

        const { data: first } = await sb
            .from("lender_api_keys")
            .insert({ key_hash: keyHash, key_prefix: keyPrefix, name: "First", email: "first@example.com" })
            .select("id")
            .single();
        createdIds.push(first!.id);

        const { error } = await sb
            .from("lender_api_keys")
            .insert({ key_hash: keyHash, key_prefix: keyPrefix, name: "Dup", email: "dup@example.com" });

        expect(error).not.toBeNull();
        expect(error!.code).toBe("23505"); // unique_violation
    });
});

// ---------------------------------------------------------------------------
// Webhook CRUD
// ---------------------------------------------------------------------------

describeIf("Webhook — DB lifecycle", () => {
    let lenderId: string;
    const webhookIds: string[] = [];

    beforeAll(async () => {
        const { keyHash, keyPrefix } = generateApiKey();
        const sb = createServerSupabaseClient();
        const { data } = await sb
            .from("lender_api_keys")
            .insert({ key_hash: keyHash, key_prefix: keyPrefix, name: "Webhook Test Lender", email: "wh@example.com" })
            .select("id")
            .single();
        lenderId = data!.id;
    });

    afterAll(async () => {
        const sb = createServerSupabaseClient();
        if (webhookIds.length > 0) {
            await sb.from("lender_webhooks").delete().in("id", webhookIds);
        }
        if (lenderId) {
            await sb.from("lender_api_keys").delete().eq("id", lenderId);
        }
    });

    it("creates a webhook with correct defaults", async () => {
        const sb = createServerSupabaseClient();
        const { data, error } = await sb
            .from("lender_webhooks")
            .insert({
                lender_id: lenderId,
                wallet_address: TEST_WALLET,
                url: "https://example.com/webhook-defaults",
                secret: "s3cr3t",
            })
            .select("id, active, failure_count, events")
            .single();

        expect(error).toBeNull();
        webhookIds.push(data!.id);

        expect(data!.active).toBe(true);
        expect(data!.failure_count).toBe(0);
        expect(data!.events).toContain("score.updated");
    });

    it("lists webhooks for a lender", async () => {
        const sb = createServerSupabaseClient();
        const { data: wh } = await sb
            .from("lender_webhooks")
            .insert({
                lender_id: lenderId,
                wallet_address: TEST_WALLET,
                url: "https://example.com/webhook-list",
                secret: "s3cr3t",
            })
            .select("id")
            .single();
        webhookIds.push(wh!.id);

        const { data: list } = await sb
            .from("lender_webhooks")
            .select("id, url")
            .eq("lender_id", lenderId);

        expect(list).not.toBeNull();
        expect(list!.length).toBeGreaterThanOrEqual(1);
        expect(list!.some((w) => w.id === wh!.id)).toBe(true);
    });

    it("deletes a webhook and it is gone", async () => {
        const sb = createServerSupabaseClient();
        const { data: created } = await sb
            .from("lender_webhooks")
            .insert({
                lender_id: lenderId,
                wallet_address: TEST_WALLET,
                url: "https://example.com/webhook-delete",
                secret: "s3cr3t",
            })
            .select("id")
            .single();

        const id = created!.id;

        await sb.from("lender_webhooks").delete().eq("id", id).eq("lender_id", lenderId);

        const { data: gone } = await sb
            .from("lender_webhooks")
            .select("id")
            .eq("id", id)
            .single();

        expect(gone).toBeNull();
    });

    it("ownership check prevents deletion by wrong lender_id", async () => {
        const sb = createServerSupabaseClient();
        const { data: created } = await sb
            .from("lender_webhooks")
            .insert({
                lender_id: lenderId,
                wallet_address: TEST_WALLET,
                url: "https://example.com/webhook-ownership",
                secret: "s3cr3t",
            })
            .select("id")
            .single();
        webhookIds.push(created!.id);

        // Try to delete with a foreign UUID
        const foreignId = "00000000-0000-0000-0000-000000000001";
        const { data: deleted } = await sb
            .from("lender_webhooks")
            .delete()
            .eq("id", created!.id)
            .eq("lender_id", foreignId)
            .select("id")
            .single();

        expect(deleted).toBeNull();

        // Verify the webhook is still there
        const { data: still } = await sb
            .from("lender_webhooks")
            .select("id")
            .eq("id", created!.id)
            .single();
        expect(still).not.toBeNull();
    });

    it("unique (lender_id, wallet_address, url) constraint is enforced", async () => {
        const sb = createServerSupabaseClient();
        const payload = {
            lender_id: lenderId,
            wallet_address: TEST_WALLET,
            url: "https://example.com/webhook-unique",
            secret: "s3cr3t",
        };

        const { data: first } = await sb.from("lender_webhooks").insert(payload).select("id").single();
        webhookIds.push(first!.id);

        const { error } = await sb.from("lender_webhooks").insert(payload).select("id").single();
        expect(error).not.toBeNull();
        expect(error!.code).toBe("23505");
    });
});

// ---------------------------------------------------------------------------
// Circuit breaker + delivery log
// ---------------------------------------------------------------------------

describeIf("Circuit Breaker + Delivery Log — DB Integration", () => {
    let lenderId: string;
    let webhookId: string;

    beforeAll(async () => {
        const { keyHash, keyPrefix } = generateApiKey();
        const sb = createServerSupabaseClient();
        const { data: lender } = await sb
            .from("lender_api_keys")
            .insert({ key_hash: keyHash, key_prefix: keyPrefix, name: "CB Test Lender", email: "cb@example.com" })
            .select("id")
            .single();
        lenderId = lender!.id;

        const { data: wh } = await sb
            .from("lender_webhooks")
            .insert({
                lender_id: lenderId,
                wallet_address: TEST_WALLET,
                url: "https://example-cb.kitecredit.test/hook",
                secret: "cb-secret-xyz",
            })
            .select("id")
            .single();
        webhookId = wh!.id;
    });

    afterAll(async () => {
        const sb = createServerSupabaseClient();
        await sb.from("lender_webhook_deliveries").delete().eq("webhook_id", webhookId);
        await sb.from("lender_webhooks").delete().eq("id", webhookId);
        await sb.from("lender_api_keys").delete().eq("id", lenderId);
    });

    beforeEach(async () => {
        // Reset webhook to active with 0 failures before each test
        const sb = createServerSupabaseClient();
        await sb
            .from("lender_webhooks")
            .update({ active: true, failure_count: 0 })
            .eq("id", webhookId);
    });

    it("successful dispatch writes a delivery log entry with status 200", async () => {
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
            new Response("OK", { status: 200 })
        );

        await dispatchWebhook(
            { id: webhookId, url: "https://example-cb.kitecredit.test/hook", secret: "cb-secret-xyz", failure_count: 0 },
            "score.updated",
            { score: 750, tier: "Strong" }
        );

        const sb = createServerSupabaseClient();
        const { data } = await sb
            .from("lender_webhook_deliveries")
            .select("event, status_code, error")
            .eq("webhook_id", webhookId)
            .order("delivered_at", { ascending: false })
            .limit(1)
            .single();

        expect(data).not.toBeNull();
        expect(data!.event).toBe("score.updated");
        expect(data!.status_code).toBe(200);
        expect(data!.error).toBeNull();

        fetchSpy.mockRestore();
    });

    it("successful dispatch resets failure_count to 0 if previously non-zero", async () => {
        const sb = createServerSupabaseClient();
        await sb.from("lender_webhooks").update({ failure_count: 3 }).eq("id", webhookId);

        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
            new Response("OK", { status: 200 })
        );

        await dispatchWebhook(
            { id: webhookId, url: "https://example-cb.kitecredit.test/hook", secret: "cb-secret-xyz", failure_count: 3 },
            "score.updated",
            { score: 750 }
        );

        const { data } = await sb.from("lender_webhooks").select("failure_count, active").eq("id", webhookId).single();
        expect(data!.failure_count).toBe(0);
        expect(data!.active).toBe(true);

        fetchSpy.mockRestore();
    });

    it("failed dispatch increments failure_count and logs error", async () => {
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
            new Response("Bad Gateway", { status: 502 })
        );

        await dispatchWebhook(
            { id: webhookId, url: "https://example-cb.kitecredit.test/hook", secret: "cb-secret-xyz", failure_count: 0 },
            "score.updated",
            { score: 400 }
        );

        const sb = createServerSupabaseClient();
        const { data } = await sb.from("lender_webhooks").select("failure_count, active").eq("id", webhookId).single();
        expect(data!.failure_count).toBe(1);
        expect(data!.active).toBe(true); // not yet tripped

        fetchSpy.mockRestore();
    });

    it("circuit breaker trips at 5 consecutive failures (active → false)", async () => {
        const sb = createServerSupabaseClient();
        await sb.from("lender_webhooks").update({ failure_count: 4 }).eq("id", webhookId);

        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
            new Response("Internal Server Error", { status: 500 })
        );

        await dispatchWebhook(
            { id: webhookId, url: "https://example-cb.kitecredit.test/hook", secret: "cb-secret-xyz", failure_count: 4 },
            "score.updated",
            { score: 400 }
        );

        const { data } = await sb.from("lender_webhooks").select("failure_count, active").eq("id", webhookId).single();
        expect(data!.failure_count).toBe(5);
        expect(data!.active).toBe(false);

        fetchSpy.mockRestore();
    });

    it("delivery log records error message on network timeout", async () => {
        const fetchSpy = jest.spyOn(global, "fetch").mockRejectedValueOnce(
            new Error("The operation was aborted")
        );

        await dispatchWebhook(
            { id: webhookId, url: "https://example-cb.kitecredit.test/hook", secret: "cb-secret-xyz", failure_count: 0 },
            "score.updated",
            { score: 400 }
        );

        const sb = createServerSupabaseClient();
        const { data } = await sb
            .from("lender_webhook_deliveries")
            .select("status_code, error")
            .eq("webhook_id", webhookId)
            .order("delivered_at", { ascending: false })
            .limit(1)
            .single();

        expect(data!.status_code).toBeNull();
        expect(data!.error).toContain("aborted");

        fetchSpy.mockRestore();
    });
});
