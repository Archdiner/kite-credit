"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import ConnectWallet from "@/components/ConnectWallet";
import ConnectGitHub from "@/components/ConnectGitHub";
import ScoreDisplay from "@/components/dashboard/ScoreDisplay";
import ScoreBreakdownPanel from "@/components/dashboard/ScoreBreakdownPanel";
import AttestationCard from "@/components/dashboard/AttestationCard";
import type { KiteScore, ZKAttestation } from "@/types";

type DashboardState = "connecting" | "scoring" | "complete" | "error";

export default function DashboardPage() {
    const { publicKey, connected } = useWallet();
    const [state, setState] = useState<DashboardState>("connecting");
    const [score, setScore] = useState<KiteScore | null>(null);
    const [attestation, setAttestation] = useState<ZKAttestation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [githubUser, setGithubUser] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Check for GitHub connection on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("github") === "connected") {
            // Fetch GitHub username
            fetch("/api/github/analyze")
                .then((res) => res.json())
                .then((json) => {
                    if (json.success && json.data?.data?.username) {
                        setGithubUser(json.data.data.username);
                    }
                })
                .catch(() => { });

            // Clean URL
            window.history.replaceState({}, "", "/dashboard");
        }
    }, []);

    const calculateScore = useCallback(async () => {
        setIsLoading(true);
        setState("scoring");
        setError(null);

        try {
            const res = await fetch("/api/score", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: publicKey?.toBase58() || null,
                    includeFinancial: true,
                }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || "Failed to calculate score");
            }

            setScore(json.data.score);
            setAttestation(json.data.attestation);
            setState("complete");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setState("error");
        } finally {
            setIsLoading(false);
        }
    }, [publicKey]);

    const hasAnySources = connected || githubUser;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* Background glow  */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-sky-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="font-outfit text-3xl font-bold text-white tracking-tight">
                        kite
                        <span className="text-sky-400">credit</span>
                    </h1>
                    <p className="mt-2 text-sm text-slate-400 font-inter">
                        Your portable, privacy-first credit identity
                    </p>
                </motion.header>

                {/* Score Display (when calculated) */}
                <AnimatePresence>
                    {score && state === "complete" && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="mb-10"
                        >
                            <ScoreDisplay score={score} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Source connections */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-900/80 backdrop-blur border border-white/5 rounded-2xl p-8 mb-6"
                >
                    <h2 className="text-lg font-semibold text-white font-outfit mb-6">
                        Connect your sources
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Solana */}
                        <div className="bg-slate-800/50 border border-white/5 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                                <span className="text-sm font-medium text-slate-300">
                                    Solana Wallet
                                </span>
                                <span className="ml-auto text-xs text-slate-500">40%</span>
                            </div>
                            <ConnectWallet compact />
                        </div>

                        {/* GitHub */}
                        <div className="bg-slate-800/50 border border-white/5 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-2 h-2 rounded-full ${githubUser ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                                <span className="text-sm font-medium text-slate-300">
                                    GitHub Profile
                                </span>
                                <span className="ml-auto text-xs text-slate-500">30%</span>
                            </div>
                            <ConnectGitHub username={githubUser} compact />
                        </div>

                        {/* Financial */}
                        <div className="bg-slate-800/50 border border-white/5 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-sm font-medium text-slate-300">
                                    Bank Verification
                                </span>
                                <span className="ml-auto text-xs text-slate-500">30%</span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-800/80 border border-emerald-500/30 px-3 py-2 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs text-emerald-300 font-mono">ZK mock proof</span>
                            </div>
                        </div>
                    </div>

                    {/* Calculate button */}
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={calculateScore}
                            disabled={!hasAnySources || isLoading}
                            className="relative group px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl opacity-60 group-hover:opacity-100 blur-[2px] transition-opacity" />
                            <div className="relative bg-slate-900 px-8 py-3 rounded-xl text-white">
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                        </svg>
                                        Analyzing...
                                    </span>
                                ) : (
                                    "Calculate Kite Score"
                                )}
                            </div>
                        </button>
                    </div>
                </motion.section>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-950/50 border border-red-500/20 rounded-xl p-4 mb-6"
                        >
                            <p className="text-sm text-red-300">{error}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Score Breakdown & Attestation (after score calculated) */}
                <AnimatePresence>
                    {score && state === "complete" && (
                        <>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="mb-6"
                            >
                                <ScoreBreakdownPanel score={score} />
                            </motion.div>

                            {attestation && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <AttestationCard attestation={attestation} />
                                </motion.div>
                            )}
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
