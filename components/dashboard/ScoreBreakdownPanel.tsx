"use client";

import { motion } from "framer-motion";
import type { ScoreBreakdown } from "@/types";

interface MetricBarProps {
    label: string;
    value: number;
    max: number;
    color: string;
    delay: number;
}

function MetricBar({ label, value, max, color, delay }: MetricBarProps) {
    const percentage = Math.min(100, (value / max) * 100);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.5 }}
            className="space-y-2"
        >
            <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-white/60 tracking-[0.15em] uppercase">
                    {label}
                </span>
                <span className="text-sm font-mono text-white/80">
                    {value}<span className="text-white/30">/{max}</span>
                </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full rounded-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: delay + 0.2, duration: 1, ease: "easeOut" }}
                />
            </div>
        </motion.div>
    );
}

export default function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
        >
            <div className="grid md:grid-cols-2 gap-6">
                {/* On-Chain Breakdown */}
                {breakdown.onChain && (
                    <div className="relative">
                        <div className="absolute inset-0 bg-sky-500/5 rounded-xl blur-xl" />
                        <div className="relative bg-slate-900/70 backdrop-blur-lg rounded-xl p-6 border border-sky-500/10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-2.5 h-2.5 bg-sky-400 rotate-45" />
                                <h3 className="text-sm font-bold text-white/60 tracking-[0.2em] uppercase">
                                    On-Chain
                                </h3>
                                <span className="ml-auto text-lg font-bold text-sky-400 font-mono">
                                    {breakdown.onChain.score}
                                </span>
                            </div>
                            <div className="space-y-4">
                                <MetricBar
                                    label="Wallet Age"
                                    value={breakdown.onChain.breakdown.walletAge}
                                    max={125}
                                    color="bg-gradient-to-r from-sky-500 to-sky-400"
                                    delay={0.5}
                                />
                                <MetricBar
                                    label="DeFi Activity"
                                    value={breakdown.onChain.breakdown.deFiActivity}
                                    max={190}
                                    color="bg-gradient-to-r from-sky-400 to-blue-500"
                                    delay={0.6}
                                />
                                <MetricBar
                                    label="Repayment History"
                                    value={breakdown.onChain.breakdown.repaymentHistory}
                                    max={125}
                                    color="bg-gradient-to-r from-blue-500 to-indigo-500"
                                    delay={0.7}
                                />
                                <MetricBar
                                    label="Staking"
                                    value={breakdown.onChain.breakdown.staking}
                                    max={60}
                                    color="bg-gradient-to-r from-indigo-500 to-violet-500"
                                    delay={0.8}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Financial Breakdown */}
                {breakdown.financial && (
                    <div className="relative">
                        <div className="absolute inset-0 bg-orange-500/5 rounded-xl blur-xl" />
                        <div className="relative bg-slate-900/70 backdrop-blur-lg rounded-xl p-6 border border-orange-500/10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-2.5 h-2.5 bg-orange-400 rotate-45" />
                                <h3 className="text-sm font-bold text-white/60 tracking-[0.2em] uppercase">
                                    Financial
                                </h3>
                                <span className="ml-auto text-lg font-bold text-orange-400 font-mono">
                                    {breakdown.financial.score}
                                </span>
                            </div>
                            <div className="space-y-4">
                                <MetricBar
                                    label="Balance Health"
                                    value={breakdown.financial.breakdown.balanceHealth}
                                    max={250}
                                    color="bg-gradient-to-r from-orange-500 to-amber-500"
                                    delay={0.5}
                                />
                                <MetricBar
                                    label="Income Consistency"
                                    value={breakdown.financial.breakdown.incomeConsistency}
                                    max={165}
                                    color="bg-gradient-to-r from-amber-500 to-orange-400"
                                    delay={0.6}
                                />
                                <MetricBar
                                    label="Verification Bonus"
                                    value={breakdown.financial.breakdown.verificationBonus}
                                    max={85}
                                    color="bg-gradient-to-r from-orange-400 to-red-400"
                                    delay={0.7}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* GitHub Bonus (if present) */}
            {breakdown.github && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="mt-4 bg-slate-900/40 backdrop-blur-lg rounded-xl p-4 border border-indigo-500/10"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-400 rotate-45 opacity-60" />
                        <span className="text-xs font-bold text-white/40 tracking-[0.2em] uppercase">
                            GitHub Bonus
                        </span>
                        <span className="text-sm font-bold text-indigo-300/60 font-mono">
                            +{Math.floor((breakdown.github.score / 300) * 100)}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono">(from {breakdown.github.score}/300 raw)</span>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
