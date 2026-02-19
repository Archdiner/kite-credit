"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ZKAttestation } from "@/types";

export default function AttestationCard({ attestation }: { attestation: ZKAttestation }) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopy = () => copyToClipboard(JSON.stringify(attestation, null, 2));

    const handleShare = async () => {
        const text = [
            `My Kite Credit Score: ${attestation.kite_score}/1000 (${attestation.tier})`,
            `Verified: ${attestation.verified_attributes.join(", ")}`,
            `Proof: ${attestation.proof.slice(0, 32)}...`,
            "",
            "Get your score → https://kite.credit",
        ].join("\n");

        if (navigator.share) {
            try {
                await navigator.share({ title: "My Kite Credit Score", text });
                return;
            } catch { /* User cancelled */ }
        }
        await copyToClipboard(text);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
        >
            <div className="bg-slate-900/70 backdrop-blur-lg rounded-xl p-5 border border-emerald-500/10">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-[10px] font-bold text-emerald-300/70 tracking-[0.2em] uppercase">
                        ZK Attestation
                    </span>
                </div>

                {/* Proof hash */}
                <div className="bg-black/30 rounded-lg p-3 mb-4 border border-white/5 overflow-hidden">
                    <p className="text-[10px] text-white/30 font-mono mb-1 tracking-wider">PROOF HASH</p>
                    <code className="text-xs text-emerald-300/80 font-mono break-all leading-relaxed block">
                        {attestation.proof}
                    </code>
                </div>

                {/* Verified attributes */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {attestation.verified_attributes.map((attr) => (
                        <span
                            key={attr}
                            className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-400/20 rounded-full text-[10px] text-emerald-300/80 font-mono tracking-wider"
                        >
                            {attr.replace(/_/g, " ")}
                        </span>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 font-bold tracking-wider uppercase text-[10px] rounded-lg hover:bg-white/10 transition-all"
                    >
                        {copied ? "✓ Copied" : "Copy Proof"}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500/20 to-sky-500/20 border border-emerald-400/20 text-emerald-200/80 font-bold tracking-wider uppercase text-[10px] rounded-lg hover:from-emerald-500/30 hover:to-sky-500/30 transition-all"
                    >
                        Share Score
                    </button>
                </div>

                <p className="text-center mt-3 text-[9px] text-white/20 font-mono tracking-wider">
                    Issued {new Date(attestation.issued_at).toLocaleString()}
                </p>
            </div>
        </motion.div>
    );
}
