"use client";

import { motion } from "framer-motion";
import type { KiteScore } from "@/types";

interface Props {
    score: KiteScore;
}

const tierColors: Record<string, string> = {
    Building: "from-amber-500 to-orange-600",
    Steady: "from-sky-400 to-blue-600",
    Strong: "from-emerald-400 to-teal-600",
    Elite: "from-violet-400 to-purple-600",
};

const tierGlowColors: Record<string, string> = {
    Building: "shadow-amber-500/20",
    Steady: "shadow-sky-500/20",
    Strong: "shadow-emerald-500/20",
    Elite: "shadow-violet-500/20",
};

export default function ScoreDisplay({ score }: Props) {
    const gradientClass = tierColors[score.tier] || tierColors.Building;
    const glowClass = tierGlowColors[score.tier] || tierGlowColors.Building;

    return (
        <div className="flex flex-col items-center">
            {/* Score ring */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className={`relative w-48 h-48 rounded-full flex items-center justify-center shadow-2xl ${glowClass}`}
            >
                {/* Outer ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                        cx="60"
                        cy="60"
                        r="54"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="6"
                    />
                    <motion.circle
                        cx="60"
                        cy="60"
                        r="54"
                        fill="none"
                        stroke="url(#scoreGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(score.total / 1000) * 339.29} 339.29`}
                        initial={{ strokeDashoffset: 339.29 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                    <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Inner content */}
                <div className="text-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        <span className="text-5xl font-bold text-white font-outfit tabular-nums">
                            {score.total}
                        </span>
                        <span className="text-lg text-slate-500 font-light">/1000</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* Tier badge */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="mt-4"
            >
                <span
                    className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${gradientClass}`}
                >
                    {score.tier}
                </span>
            </motion.div>

            {/* AI Explanation */}
            {score.explanation && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="mt-6 max-w-lg"
                >
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                                <span className="text-[8px] text-white font-bold">AI</span>
                            </div>
                            <span className="text-xs text-slate-400 font-medium">Score Analysis</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed font-inter">
                            {score.explanation}
                        </p>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
