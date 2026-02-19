"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { KiteScore, ScoreTier, ZKAttestation } from "@/types";
import { getTier } from "@/lib/scoring";

const TIER_GRADIENT: Record<ScoreTier, string> = {
    Building: "from-amber-500 to-orange-600",
    Steady: "from-orange-400 to-sky-500",
    Strong: "from-sky-400 to-blue-600",
    Elite: "from-indigo-400 via-violet-500 to-purple-600",
};

type ShareMode = "crypto" | "dev" | "unified";

interface Props {
    score: KiteScore;
    attestation: ZKAttestation | null;
}

export default function ShareScoreCard({ score, attestation }: Props) {
    const [showCard, setShowCard] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareMode, setShareMode] = useState<ShareMode>("crypto");

    const hasGitHub = !!score.breakdown.github;

    // Compute displayed score based on mode
    const cryptoScore = Math.max(0, score.total - (score.githubBonus || 0));
    const devScoreRaw = score.breakdown.github?.score ?? 0;
    const devScoreNormalized = Math.min(1000, Math.floor((devScoreRaw / 300) * 1000));
    const unifiedScore = hasGitHub
        ? Math.floor((cryptoScore * 0.8) + (devScoreNormalized * 0.2))
        : cryptoScore;

    let displayScore = cryptoScore;
    let modeLabel = "Crypto Credit";
    if (shareMode === "dev") { displayScore = devScoreNormalized; modeLabel = "Developer Reputation"; }
    if (shareMode === "unified") { displayScore = unifiedScore; modeLabel = "Unified Credit"; }

    const displayTier = getTier(displayScore);
    const proofShort = attestation?.proof?.slice(0, 18) ?? "";

    const buildShareText = useCallback(() => {
        const lines = [
            `My Kite ${modeLabel} Score: ${displayScore}/1000`,
            `Tier: ${displayTier}`,
        ];
        if (shareMode === "crypto" || shareMode === "unified") {
            lines.push(`On-Chain: ${score.breakdown.onChain.score}/500`);
        }
        if ((shareMode === "dev" || shareMode === "unified") && hasGitHub) {
            lines.push(`Dev Score: ${devScoreRaw}/300`);
        }
        if (attestation) {
            lines.push(`Proof: ${proofShort}...`);
        }
        lines.push("", "Verify your credit score → kite.credit");
        return lines.join("\n");
    }, [modeLabel, displayScore, displayTier, shareMode, score, hasGitHub, devScoreRaw, attestation, proofShort]);

    const copyText = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    }, []);

    const handleShare = useCallback(async () => {
        const text = buildShareText();
        if (navigator.share) {
            try {
                await navigator.share({ title: `My Kite ${modeLabel} Score`, text });
                return;
            } catch { /* Cancelled */ }
        }
        await copyText(text);
    }, [buildShareText, modeLabel, copyText]);

    const handleCopyLink = useCallback(async () => {
        const params = new URLSearchParams({
            s: String(displayScore),
            t: displayTier[0],
            m: shareMode,
        });
        if (attestation) params.set("p", proofShort);
        const url = `${window.location.origin}/?ref=share&${params}`;
        await copyText(url);
    }, [displayScore, displayTier, shareMode, attestation, proofShort, copyText]);

    return (
        <>
            <button
                onClick={() => setShowCard(!showCard)}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500/20 to-sky-500/20 border border-emerald-400/20 text-emerald-200/80 font-bold tracking-[0.15em] uppercase text-xs rounded-lg hover:from-emerald-500/30 hover:to-sky-500/30 transition-all"
            >
                Share Your Score
            </button>

            <AnimatePresence>
                {showCard && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="mt-4 w-full max-w-sm mx-auto"
                    >
                        {/* Score type selector */}
                        <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 mb-3">
                            <ModeTab active={shareMode === "crypto"} onClick={() => setShareMode("crypto")} label="Crypto" />
                            <ModeTab
                                active={shareMode === "dev"} onClick={() => setShareMode("dev")}
                                disabled={!hasGitHub} label="Developer"
                            />
                            <ModeTab
                                active={shareMode === "unified"} onClick={() => setShareMode("unified")}
                                disabled={!hasGitHub} label="Unified"
                            />
                        </div>

                        {/* Visual card */}
                        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${TIER_GRADIENT[displayTier]} p-[1px]`}>
                            <div className="bg-slate-950 rounded-2xl p-5 space-y-3">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 bg-sky-400 rotate-45" />
                                        <span className="text-xs font-bold text-white tracking-wider uppercase">Kite Credit</span>
                                    </div>
                                    <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
                                        {modeLabel}
                                    </span>
                                </div>

                                {/* Score + Tier */}
                                <div className="flex items-end gap-3">
                                    <span className="text-5xl font-black text-white">{displayScore}</span>
                                    <span className="text-lg text-white/40 font-mono mb-1">/1000</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rotate-45 bg-gradient-to-br ${TIER_GRADIENT[displayTier]}`} />
                                    <span className="text-lg font-bold text-white/90 uppercase tracking-wide">{displayTier}</span>
                                </div>

                                {/* Source pills */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {(shareMode === "crypto" || shareMode === "unified") && (
                                        <StatPill label="On-Chain" value={`${score.breakdown.onChain.score}`} />
                                    )}
                                    {(shareMode === "crypto" || shareMode === "unified") && score.breakdown.financial && (
                                        <StatPill label="Financial" value="✓" />
                                    )}
                                    {(shareMode === "dev" || shareMode === "unified") && hasGitHub && (
                                        <StatPill label="Dev" value={`${devScoreRaw}/300`} />
                                    )}
                                </div>

                                {/* Verification attestation */}
                                {attestation && (
                                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            <span className="text-[9px] text-emerald-300/80 font-bold tracking-widest uppercase">
                                                Verified Attestation
                                            </span>
                                        </div>
                                        <code className="block text-[9px] text-white/25 font-mono truncate">
                                            {attestation.proof}
                                        </code>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] text-white/20 font-mono">
                                                v{attestation.version} • {new Date(attestation.issued_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-[9px] text-sky-300/50 font-mono">
                                                HMAC-SHA256 signed
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleShare}
                                className="flex-1 py-2.5 bg-white/10 border border-white/10 text-white/70 font-bold tracking-wider uppercase text-[10px] rounded-lg hover:bg-white/15 transition-all"
                            >
                                {copied ? "✓ Copied!" : "Share"}
                            </button>
                            <button
                                onClick={handleCopyLink}
                                className="flex-1 py-2.5 bg-white/10 border border-white/10 text-white/70 font-bold tracking-wider uppercase text-[10px] rounded-lg hover:bg-white/15 transition-all"
                            >
                                Copy Link
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function ModeTab({ active, onClick, disabled, label }: {
    active: boolean; onClick: () => void; disabled?: boolean; label: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${active ? "bg-white/10 text-white" : disabled ? "text-white/15 cursor-not-allowed" : "text-white/40 hover:text-white/60"
                }`}
        >
            {label}
        </button>
    );
}

function StatPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full">
            <span className="text-[9px] text-white/40 font-mono">{label} </span>
            <span className="text-[9px] text-white/70 font-mono font-bold">{value}</span>
        </div>
    );
}
