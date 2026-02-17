"use client";

import { motion } from "framer-motion";

interface Props {
    username?: string | null;
    compact?: boolean;
}

export default function ConnectGitHub({ username, compact = false }: Props) {
    const handleConnect = () => {
        window.location.href = "/api/auth/github";
    };

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                {username ? (
                    <div className="flex items-center gap-2 bg-slate-800/80 border border-emerald-500/30 px-3 py-2 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm text-emerald-300 font-mono">@{username}</span>
                    </div>
                ) : (
                    <button
                        onClick={handleConnect}
                        className="bg-slate-800/90 border border-white/10 hover:border-white/30 px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors cursor-pointer"
                    >
                        Connect GitHub
                    </button>
                )}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4"
        >
            {username ? (
                <div className="flex items-center gap-3 bg-slate-800/80 border border-emerald-500/30 px-5 py-3 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm text-emerald-300 font-mono">@{username}</span>
                    <span className="text-xs text-slate-500">connected</span>
                </div>
            ) : (
                <>
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl opacity-20 group-hover:opacity-40 blur-sm transition-opacity" />
                        <button
                            onClick={handleConnect}
                            className="relative bg-slate-900/95 border border-white/10 hover:border-white/30 px-6 py-3 rounded-xl text-white font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-3"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            Connect GitHub
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 max-w-xs text-center">
                        Link your GitHub profile to build your professional reputation score.
                    </p>
                </>
            )}
        </motion.div>
    );
}
