"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";

interface Props {
    onConnected?: (address: string) => void;
    compact?: boolean;
}

export default function ConnectWallet({ onConnected, compact = false }: Props) {
    const { publicKey, connected } = useWallet();

    // Notify parent when wallet connects
    useEffect(() => {
        if (connected && publicKey && onConnected) {
            onConnected(publicKey.toBase58());
        }
    }, [connected, publicKey, onConnected]);

    const truncatedAddress = publicKey
        ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
        : null;

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                <WalletMultiButton
                    style={{
                        background: "rgba(15, 23, 42, 0.9)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: "8px",
                        fontSize: "14px",
                        height: "40px",
                        fontFamily: "var(--font-outfit)",
                    }}
                />
                {connected && truncatedAddress && (
                    <span className="text-sm text-sky-300 font-mono">{truncatedAddress}</span>
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
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl opacity-30 group-hover:opacity-50 blur-sm transition-opacity" />
                <WalletMultiButton
                    style={{
                        background: "rgba(15, 23, 42, 0.95)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: "10px",
                        fontSize: "15px",
                        height: "48px",
                        padding: "0 24px",
                        fontFamily: "var(--font-outfit)",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        position: "relative",
                    }}
                />
            </div>

            {connected && truncatedAddress && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm text-slate-300 font-mono">
                        {truncatedAddress}
                    </span>
                </motion.div>
            )}

            {!connected && (
                <p className="text-xs text-slate-500 max-w-xs text-center">
                    Connect your Solana wallet to begin building your on-chain reputation score.
                </p>
            )}
        </motion.div>
    );
}
