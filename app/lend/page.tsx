"use client";

// ---------------------------------------------------------------------------
// /lend — Kite Credit Lender Verification Portal
// ---------------------------------------------------------------------------
// The demand-side front door. DeFi protocols, landlords, and underwriters
// use this to verify a borrower's Kite Score before extending credit.
//
// Accepts either:
//   - A Solana wallet address (32-44 chars, base58) → /api/score/by-wallet/:address
//   - A Kite share ID (6-8 chars base64url)        → /api/verify/:id
//
// Auto-detects input type and hits the right endpoint.
// ---------------------------------------------------------------------------

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { ScoreTier } from "@/types";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{4,16}$/;

const TIER_COLOR: Record<ScoreTier, string> = {
    Building: "text-amber-400",
    Steady: "text-orange-400",
    Strong: "text-sky-400",
    Elite: "text-violet-400",
};

const TIER_GRADIENT: Record<ScoreTier, string> = {
    Building: "from-amber-500/20 to-orange-600/20",
    Steady: "from-orange-400/20 to-sky-500/20",
    Strong: "from-sky-400/20 to-blue-600/20",
    Elite: "from-indigo-400/20 via-violet-500/20 to-purple-600/20",
};

const ATTR_META: Record<string, { label: string; icon: string }> = {
    solana_active: { label: "Solana Wallet", icon: "◎" },
    github_linked: { label: "GitHub", icon: "⌥" },
    bank_verified: { label: "Bank Verified", icon: "⬡" },
};

type VerifyStatus = "idle" | "loading" | "found" | "not_found" | "error";

interface VerifyResult {
    found: boolean;
    valid?: boolean;
    expired?: boolean;
    score?: number;
    tier?: ScoreTier;
    verified_attributes?: string[];
    issued_at?: string | null;
    expires_at?: string | null;
    age_hours?: number | null;
    dev_score?: number;
    dev_tier?: ScoreTier;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function detectInputType(value: string): "wallet" | "share_id" | "unknown" {
    if (SOLANA_ADDRESS_REGEX.test(value)) return "wallet";
    if (SHARE_ID_REGEX.test(value)) return "share_id";
    return "unknown";
}

export default function LendPage() {
    const [input, setInput] = useState("");
    const [status, setStatus] = useState<VerifyStatus>("idle");
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    const handleVerify = async () => {
        const query = input.trim();
        if (!query) return;

        const kind = detectInputType(query);
        if (kind === "unknown") {
            setErrorMsg("Enter a valid Solana wallet address (32–44 chars) or Kite share ID.");
            setStatus("error");
            return;
        }

        setStatus("loading");
        setResult(null);
        setErrorMsg("");

        try {
            const endpoint =
                kind === "wallet"
                    ? `/api/score/by-wallet/${encodeURIComponent(query)}`
                    : `/api/verify/${encodeURIComponent(query)}`;

            const res = await fetch(endpoint);

            if (!res.ok && res.status !== 404) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data: VerifyResult = await res.json();
            setResult(data);
            setStatus(data.found === false ? "not_found" : "found");
        } catch {
            setErrorMsg("Lookup failed. Check your connection and try again.");
            setStatus("error");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleVerify();
    };

    const isValid = result?.valid === true;
    const isExpired = result?.expired === true;

    return (
        <div className="relative min-h-screen overflow-hidden font-sans bg-slate-950">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                <Image
                    src="/city_background.png"
                    alt=""
                    fill
                    className="object-cover object-center opacity-40"
                    priority
                    quality={80}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950" />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                {/* Nav */}
                <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-sky-400 rotate-45 shadow-[0_0_12px_rgba(56,189,248,0.5)]" />
                        <span className="text-sm font-bold text-white tracking-wider uppercase">Kite Credit</span>
                    </Link>
                    <Link
                        href="/"
                        className="text-[11px] text-white/40 font-mono tracking-wider hover:text-white/70 transition-colors"
                    >
                        Get Your Score →
                    </Link>
                </nav>

                {/* Main content */}
                <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="w-full max-w-2xl space-y-8"
                    >
                        {/* Header */}
                        <div className="text-center space-y-3">
                            <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                                Lender Verification Portal
                            </p>
                            <h1 className="text-3xl font-black text-white tracking-tight">
                                Verify a Kite Score
                            </h1>
                            <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                                Paste a Solana wallet address or Kite share ID to verify a
                                borrower&apos;s on-chain creditworthiness in real time.
                            </p>
                        </div>

                        {/* Lookup form */}
                        <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        if (status !== "idle") setStatus("idle");
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Wallet address or share ID"
                                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 font-mono focus:outline-none focus:border-sky-500/50 transition-colors"
                                    spellCheck={false}
                                    autoComplete="off"
                                />
                                <button
                                    onClick={handleVerify}
                                    disabled={status === "loading" || !input.trim()}
                                    className="px-6 py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/30 disabled:cursor-not-allowed text-white font-bold tracking-wider uppercase text-xs rounded-lg transition-colors"
                                >
                                    {status === "loading" ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Checking
                                        </span>
                                    ) : "Verify"}
                                </button>
                            </div>
                            <p className="text-[10px] text-white/20 font-mono">
                                Accepts a 32–44 character Solana address or a Kite share ID (e.g. &quot;aB3xR2&quot;)
                            </p>
                        </div>

                        {/* Result */}
                        <AnimatePresence mode="wait">
                            {status === "error" && (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/25"
                                >
                                    <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                                        <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <p className="text-xs text-red-300 font-mono">{errorMsg}</p>
                                </motion.div>
                            )}

                            {status === "not_found" && (
                                <motion.div
                                    key="not_found"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-white/4 border-white/10"
                                >
                                    <div className="w-6 h-6 rounded-full bg-white/5 border border-white/15 flex items-center justify-center shrink-0">
                                        <span className="text-white/40 text-xs">?</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-white/60 font-mono">No score found</p>
                                        <p className="text-[10px] text-white/25 font-mono mt-0.5">
                                            This wallet hasn&apos;t generated a Kite Score yet.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {status === "found" && result && (
                                <motion.div
                                    key="found"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-3"
                                >
                                    {/* Status banner */}
                                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                                        isValid
                                            ? "bg-emerald-500/10 border-emerald-500/25"
                                            : isExpired
                                                ? "bg-amber-500/10 border-amber-500/25"
                                                : "bg-red-500/10 border-red-500/25"
                                    }`}>
                                        {isValid ? (
                                            <>
                                                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-emerald-300 tracking-wide">Verified · Valid Score</p>
                                                    <p className="text-[10px] text-emerald-300/50 font-mono">HMAC-SHA256 proof verified by Kite</p>
                                                </div>
                                            </>
                                        ) : isExpired ? (
                                            <>
                                                <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                                                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-amber-300 tracking-wide">Score Expired</p>
                                                    <p className="text-[10px] text-amber-300/50 font-mono">
                                                        Valid signature · exceeded 90-day freshness window
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                                                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-red-300 tracking-wide">Invalid Proof</p>
                                                    <p className="text-[10px] text-red-300/50 font-mono">Signature could not be verified</p>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Score card */}
                                    {result.tier && (
                                        <div className={`rounded-2xl bg-gradient-to-br ${TIER_GRADIENT[result.tier]} border border-white/8 p-6`}>
                                            <div className="grid grid-cols-2 gap-6">
                                                {/* Score + tier */}
                                                <div className="space-y-2">
                                                    <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">Kite Score</p>
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-5xl font-black text-white">{result.score}</span>
                                                        <span className="text-lg text-white/40 font-mono mb-1">/1000</span>
                                                    </div>
                                                    <p className={`text-lg font-bold uppercase tracking-wide ${TIER_COLOR[result.tier]}`}>
                                                        {result.tier}
                                                    </p>
                                                </div>

                                                {/* Metadata */}
                                                <div className="space-y-3">
                                                    {/* Verified attributes */}
                                                    {result.verified_attributes && result.verified_attributes.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">Verified</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {result.verified_attributes.map((attr) => {
                                                                    const meta = ATTR_META[attr];
                                                                    return (
                                                                        <span
                                                                            key={attr}
                                                                            className="flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full"
                                                                        >
                                                                            <span className="text-[10px] text-white/50">{meta?.icon ?? "·"}</span>
                                                                            <span className="text-[9px] text-white/60 font-mono">{meta?.label ?? attr}</span>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Dates */}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] text-white/25 font-mono">Issued</span>
                                                            <span className="text-[9px] text-white/50 font-mono">{formatDate(result.issued_at)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] text-white/25 font-mono">Expires</span>
                                                            <span className={`text-[9px] font-mono ${isExpired ? "text-amber-400/70" : "text-white/50"}`}>
                                                                {formatDate(result.expires_at)}
                                                                {isExpired && " · expired"}
                                                            </span>
                                                        </div>
                                                        {result.age_hours !== null && result.age_hours !== undefined && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] text-white/25 font-mono">Age</span>
                                                                <span className="text-[9px] text-white/50 font-mono">
                                                                    {result.age_hours < 1
                                                                        ? "Just now"
                                                                        : result.age_hours < 24
                                                                            ? `${result.age_hours}h`
                                                                            : `${Math.floor(result.age_hours / 24)}d`}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Dev score if present */}
                                                    {result.dev_score !== undefined && result.dev_tier && (
                                                        <div className="pt-2 border-t border-white/5">
                                                            <p className="text-[9px] text-white/25 font-mono">Dev Score</p>
                                                            <p className="text-sm font-bold text-indigo-300">
                                                                {result.dev_score}/1000 · {result.dev_tier}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* API Integration guide */}
                        <div className="border-t border-white/6 pt-8 space-y-6">
                            <div className="text-center">
                                <p className="text-[10px] text-white/30 font-mono tracking-[0.2em] uppercase">
                                    Integrate Programmatically
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {/* By wallet endpoint */}
                                <div className="bg-white/3 border border-white/6 rounded-xl p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 text-[9px] font-mono rounded">GET</span>
                                        <span className="text-[10px] text-white/50 font-mono">by wallet address</span>
                                    </div>
                                    <code className="block text-[9px] text-sky-300/60 font-mono bg-black/20 rounded px-3 py-2 break-all">
                                        /api/score/by-wallet/{"{address}"}
                                    </code>
                                    <p className="text-[10px] text-white/30 leading-relaxed">
                                        Returns the latest score for a Solana wallet address. Use this when you have
                                        the borrower&apos;s wallet but not their share link.
                                    </p>
                                    <pre className="text-[9px] text-white/25 font-mono bg-black/20 rounded p-3 leading-relaxed overflow-x-auto">{`{
  "found": true,
  "valid": true,
  "expired": false,
  "score": 742,
  "tier": "Strong",
  "verified_attributes": ["solana_active"],
  "issued_at": "2026-02-22T...",
  "expires_at": "2026-05-23T...",
  "age_hours": 2
}`}</pre>
                                </div>

                                {/* By share ID endpoint */}
                                <div className="bg-white/3 border border-white/6 rounded-xl p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 text-[9px] font-mono rounded">GET</span>
                                        <span className="text-[10px] text-white/50 font-mono">by share ID</span>
                                    </div>
                                    <code className="block text-[9px] text-sky-300/60 font-mono bg-black/20 rounded px-3 py-2">
                                        /api/verify/{"{id}"}
                                    </code>
                                    <p className="text-[10px] text-white/30 leading-relaxed">
                                        Verifies a score from a borrower-provided share link. Use when the borrower
                                        has sent you their Kite share URL.
                                    </p>
                                    <pre className="text-[9px] text-white/25 font-mono bg-black/20 rounded p-3 leading-relaxed overflow-x-auto">{`{
  "valid": true,
  "expired": false,
  "score": 742,
  "tier": "Strong",
  "verified_attributes": ["solana_active"],
  "issued_at": "2026-02-22T...",
  "expires_at": "2026-05-23T...",
  "age_hours": 2
}`}</pre>
                                </div>
                            </div>

                            {/* Integration notes */}
                            <div className="bg-white/3 border border-white/6 rounded-xl p-5 space-y-4">
                                <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Integration notes</p>
                                <div className="grid md:grid-cols-3 gap-4 text-[10px] text-white/30 font-mono leading-relaxed">
                                    <div className="space-y-1">
                                        <p className="text-white/50 font-bold">CORS-enabled</p>
                                        <p>Both endpoints return <span className="text-sky-400/60">Access-Control-Allow-Origin: *</span> — call from client-side JS with no proxy.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-white/50 font-bold">Freshness</p>
                                        <p>Scores expire after 90 days. Check <span className="text-sky-400/60">expired: false</span> before extending credit.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-white/50 font-bold">Tier thresholds</p>
                                        <p>Building &lt;600 · Steady 600–699 · Strong 700–799 · Elite 800+</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
