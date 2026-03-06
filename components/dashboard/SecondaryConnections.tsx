"use client";

import { motion } from "framer-motion";

interface SecondaryConnectionsProps {
    githubUser: string | null;
    changingGitHub: boolean;
    onConnectGitHub: () => void;
    onChangeGitHub: () => void;

    // Using simple placeholders for the coming soon financial connector for now
}

export default function SecondaryConnections({
    githubUser,
    changingGitHub,
    onConnectGitHub,
    onChangeGitHub,
}: SecondaryConnectionsProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-5xl mx-auto"
        >
            <div className="text-center mb-10">
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs md:text-sm text-indigo-400 font-mono tracking-[0.3em] uppercase mb-4"
                >
                    Phase 2: Add Context
                </motion.p>
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="text-3xl md:text-5xl font-black tracking-tighter mb-4 drop-shadow-2xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white to-violet-300"
                >
                    SECONDARY IDENTITIES
                </motion.h2>
                <div className="h-1 w-16 bg-gradient-to-r from-indigo-500 to-violet-400 mx-auto rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)]" />
                <p className="mt-4 text-sm text-white/50 max-w-xl mx-auto leading-relaxed">
                    Connecting secondary identities increases your Kite Score by proving consistent activity and reputation across multiple platforms.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-20">
                {/* GitHub Developer Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="relative group"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-violet-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-60" />
                    <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-2xl p-8 border border-indigo-500/20 hover:border-indigo-400/40 transition-all shadow-2xl h-full flex flex-col">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 p-[1px] shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0">
                                <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                                    <div className="w-4 h-4 bg-indigo-400 rotate-45" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-wide uppercase">
                                GitHub
                            </h3>
                        </div>
                        <p className="text-sm text-white/60 mb-8 leading-relaxed flex-grow">
                            Developer reputation, code quality, commit history, and community trust.
                        </p>
                        {githubUser ? (
                            <div className="space-y-3 mt-auto">
                                <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-400/30 rounded-xl p-4">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-sm text-indigo-200 font-mono">@{githubUser}</span>
                                </div>
                                <button
                                    onClick={onChangeGitHub}
                                    disabled={changingGitHub}
                                    className="w-full py-2.5 text-[11px] text-indigo-300/60 hover:text-indigo-200 font-mono tracking-wider uppercase border border-indigo-500/10 hover:border-indigo-400/30 rounded-xl transition-all disabled:opacity-50"
                                >
                                    {changingGitHub ? "Switching..." : "Connect Different GitHub"}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={onConnectGitHub}
                                className="w-full mt-auto py-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold tracking-wider uppercase text-sm rounded-xl hover:from-indigo-400 hover:to-violet-500 active:scale-[0.98] transition-all shadow-lg"
                            >
                                Connect GitHub
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Financial Verification Card (Coming Soon) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="relative group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-600/10 rounded-2xl blur-xl opacity-40" />
                    <div className="relative bg-slate-900/40 backdrop-blur-lg rounded-2xl p-8 border border-white/5 shadow-2xl h-full flex flex-col grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                        <div className="absolute top-4 right-4 bg-white/10 text-white/60 text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-md border border-white/10">
                            Coming Soon
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 p-[1px] shadow-[0_0_20px_rgba(249,115,22,0.2)] shrink-0">
                                <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                                    <div className="w-4 h-4 bg-orange-400 rotate-45 opacity-50" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-white/50 tracking-wide uppercase">
                                Financial
                            </h3>
                        </div>
                        <p className="text-sm text-white/30 mb-8 leading-relaxed flex-grow">
                            ZK-verified bank balance, income consistency, and cash flow health securely verified on-device.
                        </p>

                        <div className="mt-auto w-full py-4 bg-white/5 border border-white/5 text-white/20 font-bold tracking-wider uppercase text-sm rounded-xl text-center cursor-not-allowed">
                            Connect Bank
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
