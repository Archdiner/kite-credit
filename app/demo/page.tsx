"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ScoreDisplay, { type ViewMode } from "@/components/dashboard/ScoreDisplay";
import ScoreBreakdownPanel from "@/components/dashboard/ScoreBreakdownPanel";
import AttestationCard from "@/components/dashboard/AttestationCard";
import ScoreRadarChart from "@/components/dashboard/ScoreRadarChart";
import ShareScoreCard from "@/components/dashboard/ShareScoreCard";
import type { KiteScore, ZKAttestation } from "@/types";
import { getScoreAge } from "@/lib/freshness";

// High-tier realistic mock data for Twitter screenshot / investor demo
const mockScore: KiteScore = {
    total: 812,
    tier: "Elite",
    breakdown: {
        fiveFactor: {
            paymentHistory: {
                score: 300,
                details: { onChainRepayments: 200, bankBillPay: 100 }
            },
            utilization: {
                score: 250,
                details: { creditUtilization: 100, collateralHealth: 100, balanceRatio: 50 }
            },
            creditAge: {
                score: 130,
                details: { walletAge: 80, accountAge: 50 }
            },
            creditMix: {
                score: 90,
                details: { protocolDiversity: 50, accountDiversity: 40 }
            },
            newCredit: {
                score: 80,
                details: { recentInquiries: 40, recentOpenings: 40 }
            }
        },
        onChain: {
            score: 727,
            breakdown: {
                walletAge: 120,
                deFiActivity: 140,
                repaymentHistory: 110,
                staking: 50,
                stablecoinCapital: 25,
            }
        },
        financial: null,
        github: {
            score: 85,
            breakdown: {
                accountAge: 40,
                repoPortfolio: 55,
                commitConsistency: 65,
                communityTrust: 45,
                codeQuality: 70,
            }
        },
    },
    githubBonus: 85,
    timestamp: new Date().toISOString(),
    explanation: "Your exceptional score is driven by high-impact DeFi participation and a top-tier developer reputation. Your consistent on-chain activity coupled with significant open-source contributions establishes you as an elite crypto-native profile.",
};

const mockAttestation: ZKAttestation = {
    wallet_address: "5d...3xQ",
    kite_score: 812,
    tier: "Elite",
    verified_attributes: ["solana_active", "ethereum_active", "github_linked"],
    proof: "0xb79...e43c1a2f9b8c7d6e5...",
    signer_address: "0xKiteOracle8fA2b1...",
    issued_at: new Date().toISOString(),
    version: "2.0",
};

export default function DemoPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("crypto");

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative flex flex-col pt-16 mt-[-64px]">
            {/* Background elements */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[60%] bg-violet-600/10 blur-[120px] rounded-full mix-blend-screen" />
                <div
                    className="absolute inset-0 opacity-[0.015] bg-[length:32px_32px]"
                    style={{
                        backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`
                    }}
                />
            </div>

            {/* Header */}
            <header className="absolute top-0 w-full z-50 px-6 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform duration-300">
                        <div className="w-4 h-4 rounded-sm bg-gradient-to-tr from-indigo-400 to-violet-400" />
                    </div>
                    <span className="font-bold text-lg tracking-tight backdrop-blur-sm">
                        Kite <span className="text-white/50">Credit</span>
                        <span className="ml-2 text-[10px] uppercase font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-sm">DEMO</span>
                    </span>
                </Link>
                <div className="hidden sm:flex gap-6 absolute left-1/2 -translate-x-1/2 text-sm font-medium text-white/50">
                    <Link href="/dashboard" className="px-3 py-1 bg-white text-slate-900 rounded-sm uppercase tracking-wider font-bold text-xs hover:bg-slate-200">
                        Leave Demo
                    </Link>
                </div>
            </header>

            <div className="relative z-10 flex-grow pt-24 pb-20">
                <main className="max-w-7xl mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-12"
                    >
                        {/* Header for results */}
                        <div className="text-center relative max-w-2xl mx-auto mb-16">
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl md:text-6xl font-black tracking-tighter mb-4 drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-white/70"
                            >
                                KITE SCORE READY
                            </motion.h1>
                            <div className="h-1 w-24 bg-gradient-to-r from-emerald-400 to-teal-400 mx-auto rounded-full shadow-[0_0_20px_rgba(52,211,153,0.4)]" />
                        </div>

                        <div className="grid lg:grid-cols-12 gap-8">
                            {/* Left Column: Score + Attestation + Share */}
                            <div className="lg:col-span-5 space-y-6">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-purple-500/5" />
                                    <div className="relative z-10">
                                        <ScoreDisplay score={mockScore} githubOnly={false} onModeChange={setViewMode} />

                                        {/* Score freshness demo row */}
                                        <div className="mt-5 flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                <span className="text-xs font-mono text-emerald-400">Score is verified and fresh</span>
                                                <span className="text-xs text-white/20 font-mono">
                                                    · expires in 89d
                                                </span>
                                            </div>
                                            <button
                                                className="text-[10px] font-mono text-sky-400/50 hover:text-sky-400 tracking-wider uppercase transition-colors"
                                            >
                                                Refresh →
                                            </button>
                                        </div>

                                        <div className="mt-8">
                                            <AttestationCard attestation={mockAttestation} />
                                        </div>
                                    </div>
                                </motion.div>

                                <ShareScoreCard
                                    score={mockScore}
                                    attestation={mockAttestation}
                                    activeMode={viewMode}
                                />
                            </div>

                            {/* Right Column: Radar + AI + Breakdown */}
                            <div className="lg:col-span-7 space-y-6">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="grid md:grid-cols-2 gap-6"
                                >
                                    {viewMode === "crypto" && (
                                        <div className="bg-slate-900/40 backdrop-blur-lg rounded-2xl p-6 border border-white/5 flex items-center justify-center min-h-[300px]">
                                            {mockScore.breakdown.fiveFactor && (
                                                <ScoreRadarChart breakdown={mockScore.breakdown.fiveFactor} />
                                            )}
                                        </div>
                                    )}

                                    <div className={`bg-slate-900/40 backdrop-blur-lg rounded-2xl p-6 border border-white/5 flex flex-col justify-center ${viewMode === "dev" ? "md:col-span-2" : ""}`}>
                                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">AI Analysis</h4>
                                        <p className="text-sm text-white/80 leading-relaxed italic border-l-2 border-indigo-500/30 pl-4 py-2">
                                            &quot;{mockScore.explanation}&quot;
                                        </p>
                                    </div>
                                </motion.div>

                                <ScoreBreakdownPanel
                                    breakdown={mockScore.breakdown}
                                    viewMode={viewMode}
                                />
                            </div>
                        </div>

                    </motion.div>
                </main>
            </div>
        </div>
    );
}
