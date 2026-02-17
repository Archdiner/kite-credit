"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import ScoreDisplay from "@/components/dashboard/ScoreDisplay";
import ScoreBreakdownPanel from "@/components/dashboard/ScoreBreakdownPanel";
import PlaidLinkButton from "@/components/dashboard/PlaidLinkButton";
import AttestationCard from "@/components/dashboard/AttestationCard";
import ScoreRadarChart from "@/components/dashboard/ScoreRadarChart";
import Link from "next/link";
import type { KiteScore, ZKAttestation } from "@/types";

type FlowState = "connect" | "loading" | "results";

export default function DashboardPage() {
    const { publicKey, connected, signMessage } = useWallet();
    const { setVisible } = useWalletModal();
    const [flowState, setFlowState] = useState<FlowState>("connect");
    const [kiteScore, setKiteScore] = useState<KiteScore | null>(null);
    const [attestation, setAttestation] = useState<ZKAttestation | null>(null);
    const [githubUser, setGithubUser] = useState<string | null>(null);
    const [bankConnected, setBankConnected] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const handleCalculateScore = useCallback(async () => {
        if (!publicKey) return;
        setError(null);
        setFlowState("loading");

        try {
            // Step 1: Wallet signature verification
            let signature = "";
            let nonce = "";
            if (signMessage) {
                nonce = crypto.randomUUID();
                const message = `Kite Credit: verify ownership of ${publicKey.toBase58()} | nonce: ${nonce}`;
                const messageBytes = new TextEncoder().encode(message);
                const signatureBytes = await signMessage(messageBytes);
                // Fix: Use btoa for browser compatibility instead of Buffer
                const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
                // Send nonce:signature so server can reconstruct the message
                signature = `${nonce}:${base64Signature}`;
            }

            // Step 2: Fetch composite score
            const res = await fetch("/api/score", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: publicKey.toBase58(),
                    walletSignature: signature,
                    includeGithub: !!githubUser,

                    // plaidAccessToken is now handled via HTTP-only cookie
                }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Score calculation failed");

            setKiteScore(data.data.score);
            setAttestation(data.data.attestation);
            setFlowState("results");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setFlowState("connect");
        }
    }, [publicKey, signMessage, githubUser]);

    const handleConnectGitHub = () => {
        window.location.href = "/api/auth/github";
    };

    const handlePlaidSuccess = async (publicToken: string) => {
        try {
            const res = await fetch("/api/plaid/exchange", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ public_token: publicToken }),
            });
            const data = await res.json();

            if (data.success) {
                setBankConnected(true);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to connect bank account");
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden font-sans">
            {/* City Background */}
            <div className="fixed inset-0 z-0">
                <Image
                    src="/city_background.png"
                    alt=""
                    fill
                    className="object-cover object-center"
                    priority
                    quality={90}
                />
                {/* Warm gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {/* Header */}
                <header className="px-6 md:px-12 pt-8 pb-4">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 bg-sky-400 rotate-45 shadow-[0_0_15px_rgba(56,189,248,0.6)]" />
                            <h1 className="text-xl font-bold text-white tracking-wider uppercase">
                                Kite Credit
                            </h1>
                        </div>
                        <a
                            href="/"
                            className="text-sm text-white/60 hover:text-white transition-colors tracking-widest uppercase"
                        >
                            ← Home
                        </a>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-6xl mx-auto px-6 md:px-12 py-8">
                    <AnimatePresence mode="wait">
                        {flowState === "connect" && (
                            <motion.div
                                key="connect"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -30 }}
                                transition={{ duration: 0.6 }}
                            >
                                {/* Hero Section */}
                                <div className="text-center mb-16">
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="text-xs md:text-sm text-sky-300 font-mono tracking-[0.3em] uppercase mb-4"
                                    >
                                        Decentralized Credit Protocol
                                    </motion.p>
                                    <motion.h2
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3, duration: 0.6 }}
                                        className="text-4xl md:text-7xl font-black text-white tracking-tighter mb-6 drop-shadow-2xl"
                                    >
                                        YOUR KITE SCORE
                                    </motion.h2>
                                    <div className="h-1 w-24 bg-gradient-to-r from-orange-500 to-sky-400 mx-auto rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)]" />
                                </div>

                                {/* Source Connection Cards */}
                                <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-12">
                                    {/* Solana Wallet Card */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 }}
                                        className="relative group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-blue-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-60" />
                                        <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-xl p-6 border border-sky-500/20 hover:border-sky-400/40 transition-all shadow-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-3 h-3 bg-sky-400 rotate-45" />
                                                <h3 className="text-lg font-bold text-white tracking-wide uppercase">
                                                    On-Chain
                                                </h3>
                                                <span className="ml-auto text-xs text-sky-400 font-mono">50%</span>
                                            </div>
                                            <p className="text-sm text-white/60 mb-6 leading-relaxed">
                                                Wallet age, DeFi history, staking activity, and transaction patterns.
                                            </p>
                                            {connected ? (
                                                <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-400/30 rounded-lg px-4 py-3">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-sm text-sky-200 font-mono truncate">
                                                        {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <button
                                                    className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold tracking-wider uppercase text-sm rounded-lg hover:from-sky-400 hover:to-blue-500 transition-all shadow-lg"
                                                    onClick={() => {
                                                        // Trigger wallet modal
                                                        setVisible(true);
                                                    }}
                                                >
                                                    Connect Wallet
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Financial Verification Card */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                        className="relative group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-amber-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-60" />
                                        <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-xl p-6 border border-orange-500/20 hover:border-orange-400/40 transition-all shadow-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-3 h-3 bg-orange-400 rotate-45" />
                                                <h3 className="text-lg font-bold text-white tracking-wide uppercase">
                                                    Financial
                                                </h3>
                                                <span className="ml-auto text-xs text-orange-400 font-mono">50%</span>
                                            </div>
                                            <p className="text-sm text-white/60 mb-6 leading-relaxed">
                                                ZK-verified bank balance, income consistency, and cash flow health.
                                            </p>
                                            {bankConnected ? (
                                                <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-400/30 rounded-lg px-4 py-3">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-sm text-orange-200 font-mono">Bank Connected (Plaid)</span>
                                                </div>
                                            ) : (
                                                <PlaidLinkButton
                                                    onSuccess={handlePlaidSuccess}
                                                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold tracking-wider uppercase text-sm rounded-lg hover:from-orange-400 hover:to-amber-500 transition-all shadow-lg"
                                                >
                                                    Connect Bank Account
                                                </PlaidLinkButton>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* GitHub Bonus Card */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.6 }}
                                        className="relative group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-600/10 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-40" />
                                        <div className="relative bg-slate-900/60 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-indigo-400/30 transition-all shadow-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-3 h-3 bg-indigo-400 rotate-45 opacity-60" />
                                                <h3 className="text-lg font-bold text-white/70 tracking-wide uppercase">
                                                    GitHub
                                                </h3>
                                                <span className="ml-auto text-[10px] text-indigo-300/60 font-mono border border-indigo-400/20 px-2 py-0.5 rounded-full">
                                                    BONUS
                                                </span>
                                            </div>
                                            <p className="text-sm text-white/40 mb-6 leading-relaxed">
                                                Optional professional reputation boost. Up to +100 bonus points.
                                            </p>
                                            {githubUser ? (
                                                <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-400/20 rounded-lg px-4 py-3">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                                    <span className="text-sm text-indigo-200/70 font-mono">@{githubUser}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleConnectGitHub}
                                                    className="w-full py-3 bg-white/5 border border-white/10 text-white/60 font-bold tracking-wider uppercase text-sm rounded-lg hover:bg-white/10 hover:border-indigo-400/30 transition-all"
                                                >
                                                    Connect GitHub
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Calculate Button */}
                                {connected && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.8 }}
                                        className="text-center"
                                    >
                                        <button
                                            onClick={handleCalculateScore}
                                            className="relative group px-12 py-5 text-white font-bold tracking-[0.2em] uppercase overflow-hidden rounded-sm"
                                        >
                                            {/* Button gradient background */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-sky-500 to-indigo-500 transition-opacity group-hover:opacity-90" />
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-orange-400 via-sky-400 to-indigo-400" />
                                            {/* Glow */}
                                            <div className="absolute inset-0 blur-xl bg-gradient-to-r from-orange-500/40 via-sky-500/40 to-indigo-500/40 group-hover:blur-2xl transition-all" />
                                            <span className="relative z-10 text-sm md:text-base">Calculate Kite Score</span>
                                        </button>

                                        <p className="mt-6 text-xs text-white/30 font-mono tracking-wider">
                                            Your wallet will sign a verification message to prove ownership
                                        </p>
                                    </motion.div>
                                )}

                                {/* Error message */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="mt-6 max-w-md mx-auto bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center"
                                    >
                                        <p className="text-sm text-red-300">{error}</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {flowState === "loading" && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center min-h-[60vh]"
                            >
                                <motion.div
                                    className="w-20 h-20 bg-gradient-to-br from-orange-500 to-sky-500 rotate-45 mb-12"
                                    animate={{
                                        rotate: [45, 135, 225, 315, 405],
                                        scale: [1, 1.1, 1, 0.9, 1],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />
                                <p className="text-lg text-white font-light tracking-widest uppercase">
                                    Calculating your score...
                                </p>
                                <div className="flex gap-2 mt-6">
                                    {["On-Chain", "Financial", "AI Analysis"].map((step, i) => (
                                        <motion.span
                                            key={step}
                                            initial={{ opacity: 0.3 }}
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{
                                                duration: 1.5,
                                                delay: i * 0.4,
                                                repeat: Infinity,
                                            }}
                                            className="text-xs text-sky-300/60 font-mono tracking-wider"
                                        >
                                            {step}
                                        </motion.span>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {flowState === "results" && kiteScore && (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8 }}
                                className="space-y-10"
                            >
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-200">
                                        Your Credit Profile
                                    </h2>
                                    <Link href="/how-it-works" className="text-xs text-white/50 hover:text-white/80 transition-colors uppercase tracking-widest border border-white/10 px-4 py-2 rounded-full">
                                        How It Works
                                    </Link>
                                </div>

                                <div className="grid lg:grid-cols-12 gap-8">
                                    {/* Left Column: Score + Attestation */}
                                    <div className="lg:col-span-5 space-y-6">
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-purple-500/5" />
                                            <div className="relative z-10">
                                                <ScoreDisplay score={kiteScore} />

                                                {attestation && (
                                                    <div className="mt-8">
                                                        <AttestationCard attestation={attestation} />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Right Column: Radar + Breakdown */}
                                    <div className="lg:col-span-7 space-y-6">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.2 }}
                                            className="grid md:grid-cols-2 gap-6"
                                        >
                                            <div className="bg-slate-900/40 backdrop-blur-lg rounded-2xl p-6 border border-white/5 flex items-center justify-center min-h-[300px]">
                                                {kiteScore.breakdown.fiveFactor && (
                                                    <ScoreRadarChart breakdown={kiteScore.breakdown.fiveFactor} />
                                                )}
                                            </div>

                                            <div className="bg-slate-900/40 backdrop-blur-lg rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
                                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">AI Analysis</h4>
                                                <p className="text-sm text-white/80 leading-relaxed italic border-l-2 border-indigo-500/30 pl-4 py-2">
                                                    &quot;{kiteScore.explanation}&quot;
                                                </p>
                                            </div>
                                        </motion.div>

                                        <ScoreBreakdownPanel breakdown={kiteScore.breakdown} />
                                    </div>
                                </div>

                                {/* Recalculate */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                    className="text-center pt-4 pb-12"
                                >
                                    <button
                                        onClick={() => setFlowState("connect")}
                                        className="px-8 py-3 bg-white text-slate-900 font-bold tracking-[0.2em] uppercase text-sm rounded-sm hover:bg-sky-50 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                                    >
                                        Recalculate Score
                                    </button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                {/* ZK Shield indicator */}
                <div className="fixed bottom-6 left-6 z-50">
                    <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-500/20 shadow-lg">
                        <div className="relative w-2 h-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </div>
                        <span className="text-[10px] font-bold tracking-widest text-emerald-300/80 uppercase">
                            ZK-Proof Shield Active
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
