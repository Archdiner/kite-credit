"use client";

import { motion } from "framer-motion";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useMobileWallet } from "@/components/providers/WalletProvider";
import { useState } from "react";
import Image from "next/image";

interface PrimaryWalletConnectProps {
    onConnectEthereum: () => void;
    ethLinking: boolean;
    ethError: string | null;
}

export default function PrimaryWalletConnect({ onConnectEthereum, ethLinking, ethError }: PrimaryWalletConnectProps) {
    const { setVisible } = useWalletModal();
    const { isMobile } = useMobileWallet();
    const [hoveredWallet, setHoveredWallet] = useState<"solana" | "ethereum" | null>(null);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-4xl mx-auto"
        >
            <div className="text-center mb-12">
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs md:text-sm text-sky-300 font-mono tracking-[0.3em] uppercase mb-4"
                >
                    Identity verification
                </motion.p>
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 drop-shadow-2xl"
                >
                    CONNECT PRIMARY WALLET
                </motion.h2>
                <div className="h-1 w-24 bg-gradient-to-r from-orange-500 to-sky-400 mx-auto rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)]" />
                <p className="mt-6 text-sm text-white/60 max-w-xl mx-auto leading-relaxed">
                    Select your primary Web3 wallet. This will serve as your core identity for generating a Kite Score. You can connect additional sources (like GitHub or fiat bank accounts) in the next step.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-20">
                {/* Solana Button */}
                <motion.button
                    onClick={() => {
                        if (!isMobile) setVisible(true);
                        // If mobile, they usually hit the deep link flow in the parent,
                        // but for now we trigger the modal which handles deep links via wallet adapters.
                        else setVisible(true);
                    }}
                    onHoverStart={() => setHoveredWallet("solana")}
                    onHoverEnd={() => setHoveredWallet(null)}
                    className="relative group w-full text-left"
                >
                    <div className={`absolute inset-0 bg-gradient-to-br from-sky-500/20 to-blue-600/20 rounded-2xl blur-xl transition-all duration-500 ${hoveredWallet === "solana" ? "opacity-100" : "opacity-40"}`} />
                    <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-2xl p-8 border border-sky-500/20 hover:border-sky-400/50 transition-all duration-500 shadow-2xl h-full flex flex-col items-center justify-center text-center group-hover:-translate-y-1">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 p-[1px] mb-6 shadow-[0_0_30px_rgba(56,189,248,0.3)] group-hover:shadow-[0_0_40px_rgba(56,189,248,0.5)] transition-shadow">
                            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                                {/* Simple solana logo abstraction */}
                                <div className="space-y-1 rotate-12 group-hover:rotate-0 transition-transform duration-500">
                                    <div className="w-6 h-1.5 bg-sky-400 rounded-full" />
                                    <div className="w-6 h-1.5 bg-sky-400 rounded-full" />
                                    <div className="w-6 h-1.5 bg-sky-400 rounded-full" />
                                </div>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-wider uppercase mb-3">
                            Solana
                        </h3>
                        <p className="text-sm text-sky-200/50 leading-relaxed font-mono">
                            Phantom, Solflare, Backpack
                        </p>
                    </div>
                </motion.button>

                {/* Ethereum Button */}
                <motion.button
                    onClick={onConnectEthereum}
                    disabled={ethLinking}
                    onHoverStart={() => setHoveredWallet("ethereum")}
                    onHoverEnd={() => setHoveredWallet(null)}
                    className="relative group w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className={`absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-2xl blur-xl transition-all duration-500 ${hoveredWallet === "ethereum" ? "opacity-100" : "opacity-40"}`} />
                    <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-2xl p-8 border border-emerald-500/20 hover:border-emerald-400/50 transition-all duration-500 shadow-2xl h-full flex flex-col items-center justify-center text-center group-hover:-translate-y-1">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 p-[1px] mb-6 shadow-[0_0_30px_rgba(52,211,153,0.3)] group-hover:shadow-[0_0_40px_rgba(52,211,153,0.5)] transition-shadow">
                            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                                {/* Simple ethereum logo abstraction */}
                                <div className="w-6 h-8 flex flex-col items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                    <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[18px] border-b-emerald-400 mb-1" />
                                    <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-emerald-500" />
                                </div>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-wider uppercase mb-3">
                            Ethereum
                        </h3>
                        {ethLinking ? (
                            <p className="text-sm text-emerald-300 font-mono animate-pulse">
                                Linking Wallet...
                            </p>
                        ) : (
                            <p className="text-sm text-emerald-200/50 leading-relaxed font-mono">
                                MetaMask, WalletConnect
                            </p>
                        )}
                    </div>
                </motion.button>
            </div>

            {ethError && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-center"
                >
                    <p className="inline-block bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-lg font-mono">
                        {ethError}
                    </p>
                </motion.div>
            )}
        </motion.div>
    );
}
