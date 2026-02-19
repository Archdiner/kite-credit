"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ScoreBreakdown } from "@/types";

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
        <div>
            <motion.button
                type="button"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay, duration: 0.5 }}
                className="w-full space-y-2 cursor-pointer group text-left"
                onClick={() => details && setIsExpanded(!isExpanded)}
            >
                <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white/50 tracking-[0.1em] uppercase group-hover:text-white/80 transition-colors">
                            {label}
                        </span>
                        {details && (
                            <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        )}
                    </div>
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
            </motion.button>

            <AnimatePresence initial={false}>
                {isExpanded && details && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-2 pb-1 pl-1 space-y-1 text-xs text-white/50">
                            {details}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function DetailRow({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex justify-between">
            <span>{label}</span>
            <span className={color}>{value} pts</span>
        </div>
    );
}

export default function ScoreBreakdownPanel({ breakdown, viewMode = "crypto" }: { breakdown: ScoreBreakdown; viewMode?: "crypto" | "dev" }) {
    if (viewMode === "dev" && breakdown.github) {
        const gh = breakdown.github;
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-indigo-400 rounded-full" />
                    <h3 className="text-sm font-bold text-white/80 tracking-[0.2em] uppercase">
                        Developer Score Factors
                    </h3>
                </div>

                <div className="space-y-5 bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-indigo-500/10 shadow-xl">
                    <MetricBar
                        label="Code Quality"
                        value={gh.breakdown.codeQuality}
                        max={80}
                        color="bg-gradient-to-r from-indigo-500 to-violet-400"
                        delay={0.1}
                        details={
                            <div className="text-xs text-white/50">
                                CI/CD, tests, README coverage, PR activity, code review participation
                            </div>
                        }
                    />

                    <MetricBar
                        label="Commit Consistency"
                        value={gh.breakdown.commitConsistency}
                        max={70}
                        color="bg-gradient-to-r from-violet-400 to-purple-400"
                        delay={0.2}
                        details={
                            <div className="text-xs text-white/50">
                                Recent commit frequency, active weeks, contribution regularity
                            </div>
                        }
                    />

                    <MetricBar
                        label="Repo Portfolio"
                        value={gh.breakdown.repoPortfolio}
                        max={60}
                        color="bg-gradient-to-r from-purple-400 to-fuchsia-400"
                        delay={0.3}
                        details={
                            <div className="text-xs text-white/50">
                                Public repos, language diversity, project maturity
                            </div>
                        }
                    />

                    <MetricBar
                        label="Community Trust"
                        value={gh.breakdown.communityTrust}
                        max={50}
                        color="bg-gradient-to-r from-fuchsia-400 to-pink-400"
                        delay={0.4}
                        details={
                            <div className="text-xs text-white/50">
                                Stars, followers, issues closed, merged PRs
                            </div>
                        }
                    />

                    <MetricBar
                        label="Account Age"
                        value={gh.breakdown.accountAge}
                        max={40}
                        color="bg-gradient-to-r from-pink-400 to-rose-400"
                        delay={0.5}
                    />
                </div>

                <div className="flex items-center justify-between bg-indigo-500/10 backdrop-blur-lg rounded-xl px-4 py-3 border border-indigo-500/20">
                    <span className="text-xs font-bold text-indigo-300/70 tracking-wider uppercase">Total Developer Score</span>
                    <span className="text-sm font-bold text-indigo-300 font-mono">{gh.score}/300</span>
                </div>
            </div>
        );
    }

    if (!breakdown.fiveFactor) return null;

    const { paymentHistory, utilization, creditAge, creditMix, newCredit } = breakdown.fiveFactor;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-1 h-4 bg-emerald-400 rounded-full" />
                <h3 className="text-sm font-bold text-white/80 tracking-[0.2em] uppercase">
                    Score Factors
                </h3>
            </div>

            <div className="space-y-5 bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 shadow-xl">
                <MetricBar
                    label="Payment History"
                    value={paymentHistory.score}
                    max={350}
                    color="bg-gradient-to-r from-emerald-500 to-teal-400"
                    delay={0.1}
                    details={
                        <>
                            <DetailRow label="On-Chain Repayments" value={paymentHistory.details.onChainRepayments} color="text-emerald-400" />
                            <DetailRow label="Bill Pay Consistency" value={paymentHistory.details.bankBillPay} color="text-teal-400" />
                        </>
                    }
                />

                <MetricBar
                    label="Utilization"
                    value={utilization.score}
                    max={300}
                    color="bg-gradient-to-r from-teal-400 to-sky-400"
                    delay={0.2}
                    details={
                        <>
                            <DetailRow label="Collateral Health" value={utilization.details.collateralHealth} color="text-teal-400" />
                            <DetailRow label="Balance Ratio" value={utilization.details.balanceRatio} color="text-sky-400" />
                        </>
                    }
                />

                <MetricBar
                    label="Credit Age"
                    value={creditAge.score}
                    max={150}
                    color="bg-gradient-to-r from-sky-400 to-indigo-400"
                    delay={0.3}
                    details={
                        <DetailRow label="Wallet Age" value={creditAge.details.walletAge} color="text-indigo-400" />
                    }
                />

                <MetricBar
                    label="Credit Mix"
                    value={creditMix.score}
                    max={100}
                    color="bg-gradient-to-r from-indigo-400 to-violet-400"
                    delay={0.4}
                    details={
                        <DetailRow label="Protocol Diversity" value={creditMix.details.protocolDiversity} color="text-violet-400" />
                    }
                />

                <MetricBar
                    label="New Credit"
                    value={newCredit.score}
                    max={100}
                    color="bg-gradient-to-r from-violet-400 to-purple-400"
                    delay={0.5}
                />
            </div>

            {breakdown.github && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-slate-900/30 backdrop-blur-lg rounded-xl p-4 border border-indigo-500/20"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-2 h-2 bg-indigo-400 rotate-45" />
                        <span className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">
                            Developer Score
                        </span>
                        <span className="ml-auto text-sm font-bold text-indigo-300 font-mono">
                            {breakdown.github.score}/300
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-white/40">
                        <div className="flex justify-between">
                            <span>Account Age</span>
                            <span className="text-indigo-300/70">{breakdown.github.breakdown.accountAge}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Repo Portfolio</span>
                            <span className="text-indigo-300/70">{breakdown.github.breakdown.repoPortfolio}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Commit Consistency</span>
                            <span className="text-indigo-300/70">{breakdown.github.breakdown.commitConsistency}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Community Trust</span>
                            <span className="text-indigo-300/70">{breakdown.github.breakdown.communityTrust}</span>
                        </div>
                        <div className="flex justify-between col-span-2 pt-1 border-t border-white/5 mt-1">
                            <span className="text-indigo-200/60 font-medium">Code Quality</span>
                            <span className="text-indigo-300 font-medium">{breakdown.github.breakdown.codeQuality}/80</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
