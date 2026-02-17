"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ZKAttestation } from "@/types";

export default function AttestationCard({ attestation }: { attestation: ZKAttestation }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const text = JSON.stringify(attestation, null, 2);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShare = async () => {
        const text = `My Kite Credit Score: ${attestation.kite_score}/1000 (${attestation.tier})\nVerified: ${attestation.verified_attributes.join(", ")}\nProof: ${attestation.proof.slice(0, 32)}...`;

        if (navigator.share) {
            try {
                await navigator.share({ title: "Kite Credit Attestation", text });
            } catch {
                // User cancelled or not supported
            }
        } else {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="relative"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-sky-500/5 rounded-xl blur-xl" />
            <div className="relative bg-slate-900/70 backdrop-blur-lg rounded-xl p-8 border border-emerald-500/10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="relative w-3 h-3">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                        </div>
                        <h3 className="text-sm font-bold text-white/60 tracking-[0.2em] uppercase">
                            ZK Attestation
                        </h3>
                    </div>
                    <span className="text-[10px] text-emerald-300/40 font-mono">
                        v{attestation.version}
                    </span>
                </div>

                {/* Proof display */}
                <div className="bg-black/30 rounded-lg p-4 mb-6 border border-white/5">
                    <p className="text-xs text-white/30 font-mono mb-2 tracking-wider">PROOF HASH</p>
                    <code className="text-sm text-emerald-300/80 font-mono break-all leading-relaxed">
                        {attestation.proof}
                    </code>
                </div>

                {/* Verified attributes */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {attestation.verified_attributes.map((attr) => (
                        <span
                            key={attr}
                            className="px-3 py-1 bg-emerald-500/10 border border-emerald-400/20 rounded-full text-xs text-emerald-300/80 font-mono tracking-wider"
                        >
                            {attr.replace("_", " ")}
                        </span>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCopy}
                        className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 font-bold tracking-wider uppercase text-xs rounded-lg hover:bg-white/10 transition-all"
                    >
                        {copied ? "✓ Copied" : "Copy Proof"}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500/20 to-sky-500/20 border border-emerald-400/20 text-emerald-200/80 font-bold tracking-wider uppercase text-xs rounded-lg hover:from-emerald-500/30 hover:to-sky-500/30 transition-all"
                    >
                        Share Attestation
                    </button>
                </div>

                {/* Timestamp */}
                <p className="text-center mt-4 text-[10px] text-white/20 font-mono tracking-wider">
                    Issued {new Date(attestation.issued_at).toLocaleString()}
                </p>
            </div>
        </motion.div>
    );
}
