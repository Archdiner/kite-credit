"use client";

import { motion } from "framer-motion";
import type { KiteScore, ScoreTier } from "@/types";

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

export default function ScoreDisplay({ score }: { score: KiteScore }) {
    const config = TIER_CONFIG[score.tier];
    const percentage = (score.total / 1000) * 100;

    // SVG ring parameters
    const size = 280;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col md:flex-row items-center gap-10 md:gap-16"
        >
            {/* Score Ring */}
            <div className="relative">
                {/* Glow behind ring */}
                <div
                    className="absolute inset-0 rounded-full blur-3xl opacity-40"
                    style={{ background: `radial-gradient(circle, ${config.glow}, transparent 70%)` }}
                />

                <svg width={size} height={size} className="relative z-10 -rotate-90">
                    {/* Background ring */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress ring */}
                    <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
                        className={`stroke-current`}
                        style={{
                            filter: `drop-shadow(0 0 8px ${config.glow})`,
                        }}
                        stroke="url(#scoreGradient)"
                    />
                    <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="50%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="text-6xl font-black text-white tracking-tight"
                    >
                        {score.total}
                    </motion.span>
                    <span className="text-xs text-white/40 font-mono tracking-widest mt-1">/ 1000</span>
                </div>
            </div>

            {/* Score Info */}
            <div className="text-center md:text-left">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <p className="text-xs text-white/40 font-mono tracking-[0.3em] uppercase mb-2">
                        Credit Tier
                    </p>
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-4 h-4 rotate-45 bg-gradient-to-br ${config.gradient}`} />
                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
                            {config.label}
                        </h2>
                    </div>

                    {/* Data sources badge */}
                    <div className="flex flex-wrap gap-2">
                        {score.breakdown.onChain && (
                            <span className="px-3 py-1 bg-sky-500/10 border border-sky-400/20 rounded-full text-xs text-sky-300 font-mono tracking-wider">
                                On-Chain ✓
                            </span>
                        )}
                        {score.breakdown.financial && (
                            <span className="px-3 py-1 bg-orange-500/10 border border-orange-400/20 rounded-full text-xs text-orange-300 font-mono tracking-wider">
                                Financial ✓
                            </span>
                        )}
                        {score.breakdown.github && (
                            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-400/20 rounded-full text-xs text-indigo-300/60 font-mono tracking-wider">
                                GitHub Bonus ✓
                            </span>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
