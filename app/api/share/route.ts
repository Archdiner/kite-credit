import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_PROOF_LENGTH = 256;
const MAX_ATTR_LENGTH = 64;
const MAX_ATTRS = 10;

function isValidSharePayload(body: unknown): body is Record<string, unknown> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
    const b = body as Record<string, unknown>;

    if (typeof b.cryptoScore !== "number" || b.cryptoScore < 0 || b.cryptoScore > 1000) return false;
    if (typeof b.onChainScore !== "number" || b.onChainScore < 0 || b.onChainScore > 500) return false;
    if (typeof b.proof !== "string" || b.proof.length > MAX_PROOF_LENGTH) return false;

    if (b.devScore !== null && (typeof b.devScore !== "number" || b.devScore < 0 || b.devScore > 1000)) return false;
    if (b.devRaw !== null && (typeof b.devRaw !== "number" || b.devRaw < 0 || b.devRaw > 300)) return false;

    if (!Array.isArray(b.verifiedAttrs) || b.verifiedAttrs.length > MAX_ATTRS) return false;
    for (const attr of b.verifiedAttrs) {
        if (typeof attr !== "string" || attr.length > MAX_ATTR_LENGTH) return false;
    }

    return true;
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const { success, reset } = await checkRateLimit("share:" + ip, 15, 60);

    if (!success) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": String(reset - Math.floor(Date.now() / 1000)) } }
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!isValidSharePayload(body)) {
        return NextResponse.json({ error: "Invalid share data" }, { status: 400 });
    }

    const canonical = JSON.stringify(body);
    const dataHash = createHash("sha256").update(canonical).digest("base64url");
    const supabase = createServerSupabaseClient();

    const { data: existing } = await supabase
        .from("shared_scores")
        .select("id")
        .eq("data_hash", dataHash)
        .single();

    if (existing) {
        return NextResponse.json({ id: existing.id });
    }

    for (let attempt = 0; attempt < 3; attempt++) {
        const id = randomBytes(6).toString("base64url");
        const { error } = await supabase
            .from("shared_scores")
            .insert({ id, data: body, data_hash: dataHash });

        if (!error) {
            return NextResponse.json({ id });
        }

        if (error.code !== "23505") {
            return NextResponse.json({ error: "Failed to save share data" }, { status: 500 });
        }
    }

    return NextResponse.json({ error: "Failed to generate unique ID" }, { status: 500 });
}
