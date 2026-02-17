"use client";

import { motion } from "framer-motion";
import type { ScoreBreakdown } from "@/types";
import { useState } from "react";

interface MetricBarProps {
    label: string;
    value: number;
    max: number;
    color: string;
    delay: number;
    details?: React.ReactNode;
}

function MetricBar({ label, value, max, color, delay, details }: MetricBarProps) {
    const percentage = Math.min(100, (value / max) * 100);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="group">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay, duration: 0.5 }}
                className="space-y-2 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-white/50 tracking-[0.1em] uppercase group-hover:text-white/80 transition-colors">
                        {label}
                    </span>
                    <span className="text-sm font-mono text-white/90">
                        {value}<span className="text-white/30 text-xs">/{max}</span>
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

            <motion.div
                initial={false}
                animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
                className="overflow-hidden"
            >
                <div className="pt-3 pb-1 pl-3 border-l-2 border-white/5 ml-1 mt-2 text-xs text-white/40 font-mono leading-relaxed">
                    {details}
                </div>
            </motion.div>
        </div>
    );
}

export default function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
    if (!breakdown.fiveFactor) return null;

    const { paymentHistory, utilization, creditAge, creditMix, newCredit } = breakdown.fiveFactor;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-4 bg-emerald-400 rounded-full" />
                <h3 className="text-sm font-bold text-white/80 tracking-[0.2em] uppercase">
                    Score Factors
                </h3>
            </div>

            <div className="space-y-6 bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl">
                <MetricBar
                    label="Payment History"
                    value={paymentHistory.score}
                    max={350}
                    color="bg-gradient-to-r from-emerald-500 to-teal-400"
                    delay={0.1}
                    details={
                        <div className="grid grid-cols-1 gap-1">
                            <div className="flex justify-between"><span>On-Chain Repayment History</span> <span className="text-emerald-400">{paymentHistory.details.onChainRepayments} pts</span></div>
                            <div className="flex justify-between"><span>Bank Bill Pay Consistency</span> <span className="text-teal-400">{paymentHistory.details.bankBillPay} pts</span></div>
                        </div>
                    }
                />

                <MetricBar
                    label="Utilization"
                    value={utilization.score}
                    max={300}
                    color="bg-gradient-to-r from-teal-400 to-sky-400"
                    delay={0.2}
                    details={
                        <div className="grid grid-cols-1 gap-1">
                            <div className="flex justify-between"><span>Collateral Health</span> <span className="text-teal-400">{utilization.details.collateralHealth} pts</span></div>
                            <div className="flex justify-between"><span>Bank Balance Ratio</span> <span className="text-sky-400">{utilization.details.balanceRatio} pts</span></div>
                        </div>
                    }
                />

                <MetricBar
                    label="Credit Age"
                    value={creditAge.score}
                    max={150}
                    color="bg-gradient-to-r from-sky-400 to-indigo-400"
                    delay={0.3}
                    details={
                        <div className="flex justify-between"><span>Wallet Age Score</span> <span className="text-indigo-400">{creditAge.details.walletAge} pts</span></div>
                    }
                />

                <MetricBar
                    label="Credit Mix"
                    value={creditMix.score}
                    max={100}
                    color="bg-gradient-to-r from-indigo-400 to-violet-400"
                    delay={0.4}
                    details={
                        <div className="flex justify-between"><span>DeFi Protocol Diversity</span> <span className="text-violet-400">{creditMix.details.protocolDiversity} pts</span></div>
                    }
                />

                <MetricBar
                    label="New Credit"
                    value={newCredit.score}
                    max={100}
                    color="bg-gradient-to-r from-violet-400 to-purple-400"
                    delay={0.5}
                    details={
                        <div className="flex justify-between"><span>Recent Inquiries Impact</span> <span className="text-purple-400">{newCredit.score} pts</span></div>
                    }
                />
            </div>

            {/* GitHub Bonus Section */}
            {breakdown.github && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4 bg-slate-900/30 backdrop-blur-lg rounded-xl p-4 border border-indigo-500/20 flex flex-col gap-2"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-400 rotate-45" />
                        <span className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">
                            GitHub Bonus
                        </span>
                        <span className="ml-auto text-sm font-bold text-indigo-300 font-mono">
                            +{Math.floor((breakdown.github.score / 6))} pts
                        </span>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
