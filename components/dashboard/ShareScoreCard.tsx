"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { KiteScore, ScoreTier, ZKAttestation } from "@/types";
import { getTier } from "@/lib/scoring";

const TIER_GRADIENT: Record<ScoreTier, string> = {
    Building: "from-amber-500 to-orange-600",
    Steady: "from-orange-400 to-sky-500",
    Strong: "from-sky-400 to-blue-600",
    Elite: "from-indigo-400 via-violet-500 to-purple-600",
};

type ShareMode = "crypto" | "dev";

interface Props {
    score: KiteScore;
    attestation: ZKAttestation | null;
    activeMode?: ShareMode;
}

export default function ShareScoreCard({ score, attestation, activeMode = "crypto" }: Props) {
    const [copied, setCopied] = useState(false);
    const [sharing, setSharing] = useState(false);

    const hasGitHub = !!score.breakdown.github;

    const cryptoScore = Math.max(0, score.total - (score.githubBonus || 0));
    const devScoreRaw = score.breakdown.github?.score ?? 0;
    const devScoreNormalized = Math.min(1000, Math.floor((devScoreRaw / 300) * 1000));

    let displayScore = cryptoScore;
    let modeLabel = "Crypto Credit";
    if (activeMode === "dev" && hasGitHub) {
        displayScore = devScoreNormalized;
        modeLabel = "Developer Reputation";
    }

    const displayTier = getTier(displayScore);

    const buildShareData = useCallback(() => {
        return {
            cryptoScore,
            cryptoTier: getTier(cryptoScore),
            devScore: hasGitHub ? devScoreNormalized : null,
            devTier: hasGitHub ? getTier(devScoreNormalized) : null,
            devRaw: hasGitHub ? devScoreRaw : null,
            onChainScore: score.breakdown.onChain.score,
            proof: attestation?.proof ?? "",
            attestationDate: attestation?.issued_at ?? "",
            expiresAt: attestation?.expires_at ?? "",
            verifiedAttrs: attestation?.verified_attributes ?? [],
        };
    }, [cryptoScore, devScoreNormalized, devScoreRaw, hasGitHub, score.breakdown.onChain.score, attestation]);

    const copyToClipboard = useCallback(async (text: string) => {
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
    }, []);

    const handleShareLink = useCallback(async () => {
        if (sharing) return;
        setSharing(true);

        try {
            const res = await fetch("/api/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildShareData()),
            });

            if (!res.ok) throw new Error("Failed to create share link");

            const { id } = await res.json();
            const url = `${window.location.origin}/s/${id}`;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `My Kite ${modeLabel} Score: ${displayScore}/1000`,
                        url,
                    });
                    return;
                } catch { /* User cancelled */ }
            }

            await copyToClipboard(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            const data = buildShareData();
            const encoded = btoa(JSON.stringify(data));
            const url = `${window.location.origin}/share?d=${encoded}`;
            await copyToClipboard(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } finally {
            setSharing(false);
        }
    }, [sharing, buildShareData, modeLabel, displayScore, copyToClipboard]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="w-full max-w-sm mx-auto"
        >
            {/* Visual card */}
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${TIER_GRADIENT[displayTier]} p-[1px]`}>
                <div className="bg-slate-950 rounded-2xl p-5 space-y-3">
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
                            key={displayScore}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-5xl font-black text-white"
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
                            <StatPill label="On-Chain" value={`${score.breakdown.onChain.score}`} />
                        )}
                        {activeMode === "crypto" && score.breakdown.financial && (
                            <StatPill label="Financial" value="✓" />
                        )}
                        {activeMode === "dev" && hasGitHub && (
                            <StatPill label="Dev" value={`${devScoreRaw}/300`} />
                        )}
                    </div>

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

            {/* Share button */}
            <button
                onClick={handleShareLink}
                disabled={sharing}
                className="w-full mt-3 py-3 bg-gradient-to-r from-emerald-500/20 to-sky-500/20 border border-emerald-400/20 text-emerald-200/80 font-bold tracking-[0.15em] uppercase text-[11px] rounded-lg hover:from-emerald-500/30 hover:to-sky-500/30 transition-all disabled:opacity-50"
            >
                {sharing ? "Creating Link…" : copied ? "✓ Link Copied!" : "Share Score"}
            </button>
        </motion.div>
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
