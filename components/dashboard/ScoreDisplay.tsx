"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { KiteScore, ScoreTier } from "@/types";
import { getTier } from "@/lib/scoring";

const TIER_CONFIG: Record<ScoreTier, { gradient: string; glow: string; label: string }> = {
    Building: {
        gradient: "from-amber-400 to-orange-500",
        glow: "rgba(251,146,60,0.4)",
        label: "Building",
    },
    Steady: {
        gradient: "from-orange-400 to-sky-500",
        glow: "rgba(56,189,248,0.3)",
        label: "Steady",
    },
    Strong: {
        gradient: "from-sky-400 to-blue-500",
        glow: "rgba(59,130,246,0.4)",
        label: "Strong",
    },
    Elite: {
        gradient: "from-sky-300 via-indigo-400 to-violet-500",
        glow: "rgba(139,92,246,0.4)",
        label: "Elite",
    },
};

export type ViewMode = "crypto" | "dev";

interface ScoreDisplayProps {
    score: KiteScore;
    onModeChange?: (mode: ViewMode) => void;
    githubOnly?: boolean;
}

export default function ScoreDisplay({ score, onModeChange, githubOnly = false }: ScoreDisplayProps) {
    const [mode, setMode] = useState<ViewMode>(githubOnly ? "dev" : "crypto");

    const cryptoScoreRaw = Math.max(0, score.total - (score.githubBonus || 0));
    const devScoreRaw = score.breakdown.github ? score.breakdown.github.score : 0;
    const devScoreNormalized = Math.min(1000, Math.floor((devScoreRaw / 300) * 1000));

    let currentScore = cryptoScoreRaw;
    if (mode === "dev") currentScore = devScoreNormalized;

    const currentTier = getTier(currentScore);
    const config = TIER_CONFIG[currentTier];
    const percentage = (currentScore / 1000) * 100;

    const size = 260;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const hasGitHub = !!score.breakdown.github;

    const handleModeChange = (newMode: ViewMode) => {
        setMode(newMode);
        onModeChange?.(newMode);
    };

    return (
        <div className="flex flex-col gap-5">
            {githubOnly ? (
                <div className="flex gap-1 p-1 bg-indigo-500/10 rounded-xl border border-indigo-500/20 w-full max-w-xs mx-auto md:mx-0">
                    <TabButton
                        active={true}
                        onClick={() => {}}
                        label="Developer"
                        activeClass="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                    />
                </div>
            ) : (
                <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-full max-w-xs mx-auto md:mx-0">
                    <TabButton
                        active={mode === "crypto"}
                        onClick={() => handleModeChange("crypto")}
                        label="Crypto"
                    />
                    <TabButton
                        active={mode === "dev"}
                        onClick={() => handleModeChange("dev")}
                        disabled={!hasGitHub}
                        label={hasGitHub ? "Developer" : "Dev ✦"}
                        activeClass="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                    />
                </div>
            )}

            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                {/* Score Ring */}
                <div className="relative flex-shrink-0">
                    <div
                        className="absolute inset-0 rounded-full blur-3xl transition-opacity duration-1000"
                        style={{
                            background: `radial-gradient(circle, ${config.glow}, transparent 70%)`,
                            opacity: mode === "dev" ? 0.6 : 0.4,
                        }}
                    />

                    <svg width={size} height={size} className="relative z-10 -rotate-90">
                        <circle
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
                        />
                        <motion.circle
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: offset }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className={`stroke-current ${mode === "dev" ? "text-indigo-400" : "text-sky-400"}`}
                            style={{ filter: `drop-shadow(0 0 8px ${config.glow})` }}
                        />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <motion.span
                            key={currentScore}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-5xl md:text-6xl font-black text-white tracking-tight"
                        >
                            {currentScore}
                        </motion.span>
                        <span className="text-[10px] text-white/40 font-mono tracking-widest mt-1">
                            / 1000
                        </span>
                        {mode === "dev" && (
                            <span className="mt-2 px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/40 font-mono border border-white/5">
                                Raw: {devScoreRaw}/300
                            </span>
                        )}
                    </div>
                </div>

                {/* Score Info */}
                <motion.div
                    key={mode}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-center md:text-left"
                >
                    <p className="text-[10px] text-white/40 font-mono tracking-[0.3em] uppercase mb-2">
                        {mode === "dev" ? "Reputation Tier" : "Credit Tier"}
                    </p>
                    <div className="flex items-center gap-3 mb-5 justify-center md:justify-start overflow-visible">
                        <div className={`w-3.5 h-3.5 rotate-45 bg-gradient-to-br ${config.gradient} flex-shrink-0`} />
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase whitespace-nowrap">
                            {config.label}
                        </h2>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        {mode === "crypto" && score.breakdown.onChain && (
                            <SourceBadge label="On-Chain" color="sky" />
                        )}
                        {mode === "crypto" && score.breakdown.financial && (
                            <SourceBadge label="Financial" color="orange" />
                        )}
                        {mode === "dev" && hasGitHub && (
                            <SourceBadge label="GitHub Verified" color="indigo" />
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function TabButton({
    active, onClick, disabled, label, activeClass,
}: {
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
    label: string;
    activeClass?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all truncate ${
                active
                    ? (activeClass || "bg-white/10 text-white shadow-lg")
                    : disabled
                        ? "text-white/15 cursor-not-allowed"
                        : "text-white/40 hover:text-white/60"
            }`}
        >
            {label}
        </button>
    );
}

function SourceBadge({ label, color }: { label: string; color: string }) {
    const colorMap: Record<string, string> = {
        sky: "bg-sky-500/10 border-sky-400/20 text-sky-300",
        orange: "bg-orange-500/10 border-orange-400/20 text-orange-300",
        indigo: "bg-indigo-500/10 border-indigo-400/20 text-indigo-300",
    };
    return (
        <span className={`px-2.5 py-1 border rounded-full text-[10px] font-mono tracking-wider ${colorMap[color] || colorMap.sky}`}>
            {label} ✓
        </span>
    );
}
