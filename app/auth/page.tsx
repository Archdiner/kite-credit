"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";

type Mode = "signin" | "signup";

export default function AuthPage() {
    const router = useRouter();
    const { signIn, signUp } = useAuth();
    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (mode === "signup") {
                if (!name.trim()) {
                    setError("Name is required");
                    setLoading(false);
                    return;
                }
                const result = await signUp(email, password, name);
                if (result.error) {
                    setError(result.error);
                    setLoading(false);
                    return;
                }
            } else {
                const result = await signIn(email, password);
                if (result.error) {
                    setError(result.error);
                    setLoading(false);
                    return;
                }
            }

            // Small delay to let auth state propagate
            setTimeout(() => {
                router.push("/dashboard");
            }, 300);
        } catch {
            setError("Something went wrong. Please try again.");
            setLoading(false);
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
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/70 to-slate-900/95" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 mb-12"
                >
                    <div className="w-6 h-6 bg-sky-400 rotate-45 shadow-[0_0_20px_rgba(56,189,248,0.6)]" />
                    <h1 className="text-2xl font-bold text-white tracking-wider uppercase">
                        Kite Credit
                    </h1>
                </motion.div>

                {/* Auth Card */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="w-full max-w-md"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-2xl blur-xl" />
                        <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
                            {/* Mode Toggle */}
                            <div className="flex bg-white/5 rounded-lg p-1 mb-8">
                                <button
                                    type="button"
                                    onClick={() => { setMode("signin"); setError(null); }}
                                    className={`flex-1 py-2.5 text-sm font-bold tracking-wider uppercase rounded-md transition-all ${mode === "signin"
                                            ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg"
                                            : "text-white/40 hover:text-white/60"
                                        }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMode("signup"); setError(null); }}
                                    className={`flex-1 py-2.5 text-sm font-bold tracking-wider uppercase rounded-md transition-all ${mode === "signup"
                                            ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg"
                                            : "text-white/40 hover:text-white/60"
                                        }`}
                                >
                                    Sign Up
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <AnimatePresence mode="wait">
                                    {mode === "signup" && (
                                        <motion.div
                                            key="name"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <label className="block text-xs text-white/40 font-mono tracking-widest uppercase mb-2">
                                                Full Name
                                            </label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="John Doe"
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-light"
                                                required={mode === "signup"}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

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

                                <div>
                                    <label className="block text-xs text-white/40 font-mono tracking-widest uppercase mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-light"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                {/* Error */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                                        >
                                            <p className="text-sm text-red-300 text-center">{error}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold tracking-[0.2em] uppercase text-sm rounded-lg hover:from-sky-400 hover:to-blue-500 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                                >
                                    {loading ? (
                                        <motion.div
                                            className="flex items-center justify-center gap-2"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        >
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>{mode === "signup" ? "Creating Account..." : "Signing In..."}</span>
                                        </motion.div>
                                    ) : (
                                        mode === "signup" ? "Create Account" : "Sign In"
                                    )}
                                </button>
                            </form>

                            {/* Divider */}
                            <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-xs text-white/20 font-mono tracking-wider">OR</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Back to Home */}
                            <a
                                href="/"
                                className="block text-center text-sm text-white/40 hover:text-white/60 transition-colors tracking-widest uppercase"
                            >
                                ← Back to Home
                            </a>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="mt-6 text-center text-xs text-white/20 font-mono tracking-wider">
                        Your data is encrypted and never shared
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
