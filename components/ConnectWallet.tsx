"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import { useMobileWallet } from "@/components/providers/WalletProvider";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface Props {
    onConnected?: (address: string) => void;
    compact?: boolean;
}

export default function ConnectWallet({ onConnected, compact = false }: Props) {
    const { publicKey, connected } = useWallet();
    const { isMobile, mobileWalletAddress, setMobileWalletAddress } = useMobileWallet();
    const [addressInput, setAddressInput] = useState("");
    const [inputError, setInputError] = useState<string | null>(null);

    const effectiveAddress = isMobile
        ? mobileWalletAddress
        : publicKey?.toBase58() ?? null;
    const isConnected = isMobile ? !!mobileWalletAddress : connected;

    useEffect(() => {
        if (isConnected && effectiveAddress && onConnected) {
            onConnected(effectiveAddress);
        }
    }, [isConnected, effectiveAddress, onConnected]);

    const truncatedAddress = effectiveAddress
        ? `${effectiveAddress.slice(0, 4)}...${effectiveAddress.slice(-4)}`
        : null;

    const handleMobileSubmit = () => {
        const address = addressInput.trim();
        setInputError(null);
        if (!address) {
            setInputError("Please enter a wallet address");
            return;
        }
        if (!SOLANA_ADDRESS_REGEX.test(address)) {
            setInputError("Invalid Solana wallet address");
            return;
        }
        setMobileWalletAddress(address);
        setAddressInput("");
    };

    if (compact) {
        if (isMobile && isConnected && truncatedAddress) {
            return (
                <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-400/30 rounded-lg px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm text-sky-300 font-mono">{truncatedAddress}</span>
                </div>
            );
        }
        if (!isMobile) {
            return (
                <div className="flex items-center gap-3">
                    <WalletMultiButton
                        style={{
                            background: "rgba(15, 23, 42, 0.9)",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            height: "44px",
                            minWidth: "44px",
                            fontFamily: "var(--font-outfit)",
                        }}
                    />
                    {connected && truncatedAddress && (
                        <span className="text-sm text-sky-300 font-mono">{truncatedAddress}</span>
                    )}
                </div>
            );
        }
    }

    if (isMobile) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 w-full"
            >
                {isConnected && truncatedAddress ? (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm text-slate-300 font-mono">{truncatedAddress}</span>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            value={addressInput}
                            onChange={(e) => {
                                setAddressInput(e.target.value);
                                setInputError(null);
                            }}
                            placeholder="Paste your Solana address"
                            className="w-full px-4 py-3 bg-white/5 border border-sky-500/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-mono"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {inputError && <p className="text-xs text-red-400">{inputError}</p>}
                        <button
                            onClick={handleMobileSubmit}
                            disabled={!addressInput.trim()}
                            className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold tracking-wider uppercase text-sm rounded-lg active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Connect Wallet
                        </button>
                        <p className="text-xs text-slate-500 max-w-xs text-center">
                            Open your wallet app, copy your address, and paste it above.
                        </p>
                    </>
                )}
            </motion.div>
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
