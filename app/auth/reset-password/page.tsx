"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type PageState = "loading" | "form" | "success" | "invalid";

export default function ResetPasswordPage() {
    const router = useRouter();
    const { updatePassword } = useAuth();
    const [pageState, setPageState] = useState<PageState>("loading");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Supabase puts the recovery token in the URL hash (#access_token=...&type=recovery)
        // The browser Supabase client detects this via detectSessionInUrl: true and fires
        // an onAuthStateChange event with event === "PASSWORD_RECOVERY".
        const supabase = createBrowserSupabaseClient();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setPageState("form");
            }
        });

        // If no PASSWORD_RECOVERY event fires within 3 seconds, the link is invalid/expired
        const timeout = setTimeout(() => {
            setPageState((s) => s === "loading" ? "invalid" : s);
        }, 3000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        const result = await updatePassword(password);
        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            setPageState("success");
            setTimeout(() => router.push("/dashboard"), 2500);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden font-sans">
            <div className="fixed inset-0 z-0">
                <Image src="/city_background.png" alt="" fill className="object-cover object-center" priority quality={90} />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/70 to-slate-900/95" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-12">
                    <div className="w-6 h-6 bg-sky-400 rotate-45 shadow-[0_0_20px_rgba(56,189,248,0.6)]" />
                    <h1 className="text-2xl font-bold text-white tracking-wider uppercase">Kite Credit</h1>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="w-full max-w-md">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-2xl blur-xl" />
                        <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
                            <AnimatePresence mode="wait">
                                {pageState === "loading" && (
                                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                                        <div className="w-8 h-8 border-2 border-white/20 border-t-sky-400 rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-white/40 text-sm font-mono">Verifying reset link...</p>
                                    </motion.div>
                                )}

                                {pageState === "invalid" && (
                                    <motion.div key="invalid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                                        <div className="w-14 h-14 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-xl font-bold text-white mb-2">Link expired</h2>
                                        <p className="text-white/40 text-sm leading-relaxed mb-6">
                                            This reset link is invalid or has expired.<br />Reset links are valid for 1 hour.
                                        </p>
                                        <Link href="/auth/forgot-password" className="text-sky-400 hover:text-sky-300 text-sm font-mono underline transition-colors">
                                            Request a new link
                                        </Link>
                                    </motion.div>
                                )}

                                {pageState === "form" && (
                                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <h2 className="text-lg font-bold text-white mb-1 tracking-wide">Set new password</h2>
                                        <p className="text-white/40 text-sm mb-8">Choose a strong password for your account.</p>

                                        <form onSubmit={handleSubmit} className="space-y-5">
                                            <div>
                                                <label className="block text-xs text-white/40 font-mono tracking-widest uppercase mb-2">New Password</label>
                                                <input
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-light"
                                                    required
                                                    minLength={8}
                                                />
                                                <p className="text-[10px] text-white/25 font-mono mt-1.5">Minimum 8 characters</p>
                                            </div>

                                            <div>
                                                <label className="block text-xs text-white/40 font-mono tracking-widest uppercase mb-2">Confirm Password</label>
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-light"
                                                    required
                                                />
                                            </div>

                                            <AnimatePresence>
                                                {error && (
                                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
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
                                                        Updating...
                                                    </span>
                                                ) : "Update Password"}
                                            </button>
                                        </form>
                                    </motion.div>
                                )}

                                {pageState === "success" && (
                                    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                                        <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h2 className="text-xl font-bold text-white mb-2">Password updated</h2>
                                        <p className="text-white/40 text-sm">Redirecting you to the dashboard...</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {pageState !== "success" && (
                        <Link href="/auth" className="mt-6 inline-flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm">
                            ← Back to Sign In
                        </Link>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
