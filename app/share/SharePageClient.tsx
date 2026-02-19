"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ScoreTier } from "@/types";
import { getTier } from "@/lib/scoring";

const TIER_GRADIENT: Record<ScoreTier, string> = {
    Building: "from-amber-500 to-orange-600",
    Steady: "from-orange-400 to-sky-500",
    Strong: "from-sky-400 to-blue-600",
    Elite: "from-indigo-400 via-violet-500 to-purple-600",
};

interface ShareData {
    cryptoScore: number;
    cryptoTier: ScoreTier;
    devScore: number | null;
    devTier: ScoreTier | null;
    devRaw: number | null;
    onChainScore: number;
    proof: string;
    attestationDate: string;
    verifiedAttrs: string[];
}

function decodeShareData(encoded: string): ShareData | null {
    try {
        const json = atob(encoded);
        const parsed = JSON.parse(json);
        return {
            ...parsed,
            cryptoTier: getTier(parsed.cryptoScore),
            devTier: parsed.devScore != null ? getTier(parsed.devScore) : null,
        };
    } catch {
        return null;
    }
}

export default function SharePageClient({ encodedData }: { encodedData?: string }) {
    const [activeMode, setActiveMode] = useState<"crypto" | "dev">("crypto");

    const data = useMemo(() => {
        if (!encodedData) return null;
        return decodeShareData(encodedData);
    }, [encodedData]);

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
                    <Link
                        href="/"
                        className="px-6 py-3 bg-white/10 border border-white/20 text-white/80 font-bold tracking-wider uppercase text-xs rounded-lg hover:bg-white/20 transition-all"
                    >
                        Get Your Score
                    </Link>
                </div>
            </div>
        );
    }

    const hasDevScore = data.devScore !== null;
    const displayScore = activeMode === "dev" && hasDevScore ? data.devScore! : data.cryptoScore;
    const displayTier = activeMode === "dev" && hasDevScore ? data.devTier! : data.cryptoTier;
    const modeLabel = activeMode === "dev" ? "Developer Reputation" : "Crypto Credit";

    return (
        <div className="relative min-h-screen overflow-hidden font-sans">
            <div className="fixed inset-0 z-0">
                <Image src="/city_background.png" alt="" fill className="object-cover object-center" priority quality={90} />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
                {/* Kite branding */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mb-8"
                >
                    <div className="w-4 h-4 bg-sky-400 rotate-45 shadow-[0_0_15px_rgba(56,189,248,0.6)]" />
                    <span className="text-sm font-bold text-white tracking-wider uppercase">Kite Credit</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-sm"
                >
                    {/* Mode tabs */}
                    <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 mb-4">
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
                            disabled={!hasDevScore}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all ${
                                activeMode === "dev"
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                                    : !hasDevScore
                                        ? "text-white/15 cursor-not-allowed"
                                        : "text-white/40 hover:text-white/60"
                            }`}
                        >
                            Developer
                        </button>
                    </div>

                    {/* Score card */}
                    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${TIER_GRADIENT[displayTier]} p-[1px]`}>
                        <div className="bg-slate-950 rounded-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 bg-sky-400 rotate-45" />
                                    <span className="text-xs font-bold text-white tracking-wider uppercase">Kite Credit</span>
                                </div>
                                <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
                                    {modeLabel}
                                </span>
                            </div>

                            <div className="flex items-end gap-3">
                                <motion.span
                                    key={`${activeMode}-${displayScore}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-6xl font-black text-white"
                                >
                                    {displayScore}
                                </motion.span>
                                <span className="text-lg text-white/40 font-mono mb-1">/1000</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rotate-45 bg-gradient-to-br ${TIER_GRADIENT[displayTier]}`} />
                                <span className="text-lg font-bold text-white/90 uppercase tracking-wide">{displayTier}</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {activeMode === "crypto" && (
                                    <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full">
                                        <span className="text-[9px] text-white/40 font-mono">On-Chain </span>
                                        <span className="text-[9px] text-white/70 font-mono font-bold">{data.onChainScore}</span>
                                    </div>
                                )}
                                {activeMode === "dev" && data.devRaw !== null && (
                                    <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full">
                                        <span className="text-[9px] text-white/40 font-mono">Dev </span>
                                        <span className="text-[9px] text-white/70 font-mono font-bold">{data.devRaw}/300</span>
                                    </div>
                                )}
                            </div>

                            {data.proof && (
                                <div className="pt-3 border-t border-white/5 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        <span className="text-[9px] text-emerald-300/80 font-bold tracking-widest uppercase">
                                            Verified Attestation
                                        </span>
                                    </div>
                                    <code className="block text-[9px] text-white/25 font-mono truncate">
                                        {data.proof}
                                    </code>
                                    {data.verifiedAttrs.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {data.verifiedAttrs.map((attr) => (
                                                <span
                                                    key={attr}
                                                    className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-400/20 rounded-full text-[8px] text-emerald-300/70 font-mono"
                                                >
                                                    {attr.replace(/_/g, " ")}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {data.attestationDate && (
                                        <span className="text-[9px] text-white/20 font-mono">
                                            {new Date(data.attestationDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CTA */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-8 text-center"
                    >
                        <Link
                            href="/"
                            className="inline-block px-10 py-4 bg-gradient-to-r from-orange-500 via-sky-500 to-indigo-500 text-white font-bold tracking-[0.2em] uppercase text-sm rounded-sm hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(56,189,248,0.3)]"
                        >
                            Get Your Kite Score
                        </Link>
                        <p className="mt-4 text-[10px] text-white/30 font-mono tracking-wider">
                            Decentralized Credit Protocol
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
