"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ScoreTier, ShareData } from "@/types";

const TIER_GRADIENT: Record<ScoreTier, string> = {
    Building: "from-amber-500 to-orange-600",
    Steady:   "from-orange-400 to-sky-500",
    Strong:   "from-sky-400 to-blue-600",
    Elite:    "from-indigo-400 via-violet-500 to-purple-600",
};

const TIER_COLOR: Record<ScoreTier, string> = {
    Building: "text-amber-400",
    Steady:   "text-orange-400",
    Strong:   "text-sky-400",
    Elite:    "text-violet-400",
};

const ATTR_META: Record<string, { label: string; icon: string }> = {
    solana_active: { label: "Solana Wallet",  icon: "◎" },
    github_linked: { label: "GitHub",         icon: "⌥" },
    bank_verified: { label: "Bank Verified",  icon: "⬡" },
};

function formatAge(iso: string | null | undefined): string {
    if (!iso) return "Unknown";
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                });
            }}
            className="text-[9px] font-mono text-white/30 hover:text-sky-400 transition-colors shrink-0"
        >
            {copied ? "copied" : "copy"}
        </button>
    );
}

interface Props {
    data: ShareData | null;
    /** Present when rendered from /s/[id] — indicates server-side HMAC was verified */
    proofValid?: boolean;
    /** The short share ID, used to show the API endpoint */
    shareId?: string;
}

export default function SharePageClient({ data, proofValid, shareId }: Props) {
    const [activeMode, setActiveMode] = useState<"crypto" | "dev">("crypto");
    const [apiExpanded, setApiExpanded] = useState(false);

    if (!data) {
        return (
            <div className="relative min-h-screen overflow-hidden font-sans">
                <div className="fixed inset-0 z-0">
                    <Image src="/city_background.png" alt="" fill className="object-cover object-center" priority quality={90} />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90" />
                </div>
                <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-6">
                    <div className="w-5 h-5 bg-sky-400 rotate-45 mb-2" />
                    <p className="text-white/60 text-sm font-mono tracking-wider">Invalid or expired share link</p>
                    <Link href="/" className="px-6 py-3 bg-white/10 border border-white/20 text-white/80 font-bold tracking-wider uppercase text-xs rounded-lg hover:bg-white/20 transition-all">
                        Get Your Score
                    </Link>
                </div>
            </div>
        );
    }

    const hasDevScore = data.devScore !== null;
    const displayScore = activeMode === "dev" && hasDevScore ? data.devScore! : data.cryptoScore;
    const displayTier  = activeMode === "dev" && hasDevScore ? data.devTier!  : data.cryptoTier;
    // proofValid is only present when loaded from /s/[id] (DB-backed, server-verified)
    const isVerified = proofValid === true;
    const hasVerification = proofValid !== undefined;

    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://kitecredit.xyz";
    const apiUrl = shareId ? `${appUrl}/api/verify/${shareId}` : null;

    return (
        <div className="relative min-h-screen overflow-hidden font-sans">
            <div className="fixed inset-0 z-0">
                <Image src="/city_background.png" alt="" fill className="object-cover object-center" priority quality={90} />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
                {/* Branding */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-8">
                    <div className="w-4 h-4 bg-sky-400 rotate-45 shadow-[0_0_15px_rgba(56,189,248,0.6)]" />
                    <span className="text-sm font-bold text-white tracking-wider uppercase">Kite Credit</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.05 }}
                    className="w-full max-w-sm space-y-3"
                >
                    {/* ── Verification status banner ───────────────────────────── */}
                    {hasVerification && (
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                            isVerified
                                ? "bg-emerald-500/10 border-emerald-500/25"
                                : "bg-red-500/10 border-red-500/25"
                        }`}>
                            {isVerified ? (
                                <>
                                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-emerald-300 tracking-wide">Signature Valid</p>
                                        <p className="text-[10px] text-emerald-300/50 font-mono">HMAC-SHA256 verified by Kite</p>
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
                                        <p className="text-xs font-bold text-red-300 tracking-wide">Invalid Signature</p>
                                        <p className="text-[10px] text-red-300/50 font-mono">Proof could not be verified</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Mode tabs ────────────────────────────────────────────── */}
                    {hasDevScore && (
                        <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
                            <button
                                onClick={() => setActiveMode("crypto")}
                                className={`flex-1 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all ${
                                    activeMode === "crypto" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                                }`}
                            >
                                Crypto
                            </button>
                            <button
                                onClick={() => setActiveMode("dev")}
                                className={`flex-1 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all ${
                                    activeMode === "dev"
                                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                                        : "text-white/40 hover:text-white/60"
                                }`}
                            >
                                Developer
                            </button>
                        </div>
                    )}

                    {/* ── Main score card ──────────────────────────────────────── */}
                    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${TIER_GRADIENT[displayTier]} p-[1px]`}>
                        <div className="bg-slate-950 rounded-2xl p-6 space-y-4">
                            {/* Header row */}
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
                                    {activeMode === "dev" ? "Developer Reputation" : "Crypto Credit"}
                                </span>
                                {data.attestationDate && (
                                    <span className="text-[9px] text-white/25 font-mono">
                                        {formatAge(data.attestationDate)}
                                    </span>
                                )}
                            </div>

                            {/* Score */}
                            <div className="flex items-end gap-3">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={`${activeMode}-${displayScore}`}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        className="text-6xl font-black text-white"
                                    >
                                        {displayScore}
                                    </motion.span>
                                </AnimatePresence>
                                <span className="text-lg text-white/40 font-mono mb-1">/1000</span>
                            </div>

                            {/* Tier */}
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rotate-45 bg-gradient-to-br ${TIER_GRADIENT[displayTier]}`} />
                                <span className={`text-lg font-bold uppercase tracking-wide ${TIER_COLOR[displayTier]}`}>
                                    {displayTier}
                                </span>
                            </div>

                            {/* Verified attributes */}
                            {data.verifiedAttrs.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {data.verifiedAttrs.map((attr) => {
                                        const meta = ATTR_META[attr];
                                        return (
                                            <span
                                                key={attr}
                                                className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-full"
                                            >
                                                <span className="text-[10px] text-white/50">{meta?.icon ?? "·"}</span>
                                                <span className="text-[9px] text-white/60 font-mono">{meta?.label ?? attr}</span>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Proof row */}
                            {data.proof && (
                                <div className="pt-3 border-t border-white/5">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[9px] text-white/25 font-mono uppercase tracking-widest">Proof</span>
                                        <CopyButton text={data.proof} />
                                    </div>
                                    <code className="block text-[9px] text-white/20 font-mono break-all leading-relaxed">
                                        {data.proof}
                                    </code>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Developer API section ────────────────────────────────── */}
                    {apiUrl && (
                        <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
                            <button
                                onClick={() => setApiExpanded((v) => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left"
                            >
                                <span className="text-[10px] text-white/40 font-mono tracking-wider uppercase">Verify via API</span>
                                <span className="text-white/25 text-xs">{apiExpanded ? "▲" : "▼"}</span>
                            </button>
                            <AnimatePresence>
                                {apiExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-4 pb-4 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 text-[9px] text-sky-300/70 font-mono bg-black/30 px-2 py-1.5 rounded truncate">
                                                    GET {apiUrl}
                                                </code>
                                                <CopyButton text={apiUrl} />
                                            </div>
                                            <pre className="text-[9px] text-white/30 font-mono bg-black/30 rounded p-3 leading-relaxed overflow-x-auto">
{`{
  "valid": ${isVerified},
  "score": ${data.cryptoScore},
  "tier": "${data.cryptoTier}",
  "verified_attributes": ${JSON.stringify(data.verifiedAttrs)},
  "issued_at": "${data.attestationDate ?? ""}",
  "age_hours": ...
}`}
                                            </pre>
                                            <p className="text-[9px] text-white/20 font-mono leading-relaxed">
                                                Returns CORS-enabled JSON. Use this endpoint to gate access or set collateral ratios programmatically.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* ── CTA ─────────────────────────────────────────────────── */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pt-2 text-center">
                        <Link
                            href="/"
                            className="inline-block px-10 py-4 bg-gradient-to-r from-orange-500 via-sky-500 to-indigo-500 text-white font-bold tracking-[0.2em] uppercase text-sm rounded-sm hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(56,189,248,0.3)]"
                        >
                            Get Your Kite Score
                        </Link>
                        <p className="mt-4 text-[10px] text-white/30 font-mono tracking-wider">Decentralized Credit Protocol</p>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
