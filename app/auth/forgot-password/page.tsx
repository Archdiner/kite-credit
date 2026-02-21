"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ForgotPasswordPage() {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const result = await resetPassword(email);
        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            setSent(true);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden font-sans">
            <div className="fixed inset-0 z-0">
                <Image src="/city_background.png" alt="" fill className="object-cover object-center" priority quality={90} />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/70 to-slate-900/95" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 mb-12"
                >
                    <div className="w-6 h-6 bg-sky-400 rotate-45 shadow-[0_0_20px_rgba(56,189,248,0.6)]" />
                    <h1 className="text-2xl font-bold text-white tracking-wider uppercase">Kite Credit</h1>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="w-full max-w-md"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-2xl blur-xl" />
                        <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
                            <AnimatePresence mode="wait">
                                {sent ? (
                                    <motion.div
                                        key="sent"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="text-center py-4"
                                    >
                                        <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-xl font-bold text-white mb-2">Reset link sent</h2>
                                        <p className="text-white/50 text-sm leading-relaxed">
                                            Check your inbox at <span className="text-white/80 font-medium">{email}</span>.<br />
                                            The link expires in 1 hour.
                                        </p>
                                        <p className="text-white/25 text-xs font-mono mt-4">
                                            Didn&apos;t receive it? Check spam or{" "}
                                            <button onClick={() => setSent(false)} className="text-sky-400 hover:text-sky-300 underline transition-colors">
                                                try again
                                            </button>
                                        </p>
                                    </motion.div>
                                ) : (
                                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <h2 className="text-lg font-bold text-white mb-1 tracking-wide">Reset your password</h2>
                                        <p className="text-white/40 text-sm mb-8">
                                            Enter your account email and we&apos;ll send a reset link.
                                        </p>

                                        <form onSubmit={handleSubmit} className="space-y-5">
                                            <div>
                                                <label className="block text-xs text-white/40 font-mono tracking-widest uppercase mb-2">
                                                    Email
                                                </label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="you@example.com"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-light"
                                                    required
                                                />
                                            </div>

                                            <AnimatePresence>
                                                {error && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0 }}
                                                        className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                                                    >
                                                        <p className="text-sm text-red-300 text-center">{error}</p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold tracking-[0.2em] uppercase text-sm rounded-lg hover:from-sky-400 hover:to-blue-500 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Sending...
                                                    </span>
                                                ) : "Send Reset Link"}
                                            </button>
                                        </form>

                                        <div className="flex items-center gap-4 my-6">
                                            <div className="flex-1 h-px bg-white/10" />
                                        </div>

                                        <Link href="/auth" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                                            ← Back to Sign In
                                        </Link>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
