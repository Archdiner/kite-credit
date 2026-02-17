"use client";

import { motion } from "framer-motion";
import type { KiteScore } from "@/types";

interface Props {
    score: KiteScore;
}

function BarSegment({
    label,
    value,
    max,
    color,
    delay,
}: {
    label: string;
    value: number;
    max: number;
    color: string;
    delay: number;
}) {
    const pct = Math.round((value / max) * 100);

    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">{label}</span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {value}/{max}
                </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full rounded-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

export default function ScoreBreakdownPanel({ score }: Props) {
    return (
        <div className="bg-slate-900/80 backdrop-blur border border-white/5 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-white font-outfit mb-6">
                Score Breakdown
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* On-chain */}
                {score.breakdown.onChain && (
                    <div>
                        <h4 className="text-sm font-medium text-sky-400 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            On-Chain (40%)
                        </h4>
                        <div className="space-y-3">
                            <BarSegment
                                label="Wallet Age"
                                value={score.breakdown.onChain.breakdown.walletAge}
                                max={100}
                                color="bg-sky-500"
                                delay={0.1}
                            />
                            <BarSegment
                                label="DeFi Activity"
                                value={score.breakdown.onChain.breakdown.deFiActivity}
                                max={150}
                                color="bg-sky-400"
                                delay={0.2}
                            />
                            <BarSegment
                                label="Repayment"
                                value={score.breakdown.onChain.breakdown.repaymentHistory}
                                max={100}
                                color="bg-sky-300"
                                delay={0.3}
                            />
                            <BarSegment
                                label="Staking"
                                value={score.breakdown.onChain.breakdown.staking}
                                max={50}
                                color="bg-sky-200"
                                delay={0.4}
                            />
                        </div>
                    </div>
                )}

                {/* GitHub */}
                {score.breakdown.github && (
                    <div>
                        <h4 className="text-sm font-medium text-emerald-400 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Professional (30%)
                        </h4>
                        <div className="space-y-3">
                            <BarSegment
                                label="Account Age"
                                value={score.breakdown.github.breakdown.accountAge}
                                max={50}
                                color="bg-emerald-500"
                                delay={0.15}
                            />
                            <BarSegment
                                label="Repo Portfolio"
                                value={score.breakdown.github.breakdown.repoPortfolio}
                                max={75}
                                color="bg-emerald-400"
                                delay={0.25}
                            />
                            <BarSegment
                                label="Commit Consistency"
                                value={score.breakdown.github.breakdown.commitConsistency}
                                max={100}
                                color="bg-emerald-300"
                                delay={0.35}
                            />
                            <BarSegment
                                label="Community Trust"
                                value={score.breakdown.github.breakdown.communityTrust}
                                max={75}
                                color="bg-emerald-200"
                                delay={0.45}
                            />
                        </div>
                    </div>
                )}

                {/* Financial */}
                {score.breakdown.financial && (
                    <div>
                        <h4 className="text-sm font-medium text-violet-400 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                            Financial (30%)
                        </h4>
                        <div className="space-y-3">
                            <BarSegment
                                label="Balance Health"
                                value={score.breakdown.financial.breakdown.balanceHealth}
                                max={150}
                                color="bg-violet-500"
                                delay={0.2}
                            />
                            <BarSegment
                                label="Income Consistency"
                                value={score.breakdown.financial.breakdown.incomeConsistency}
                                max={100}
                                color="bg-violet-400"
                                delay={0.3}
                            />
                            <BarSegment
                                label="Verification Bonus"
                                value={score.breakdown.financial.breakdown.verificationBonus}
                                max={50}
                                color="bg-violet-300"
                                delay={0.4}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
