"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ZKAttestation } from "@/types";

interface Props {
    attestation: ZKAttestation;
}

export default function AttestationCard({ attestation }: Props) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const attestationJson = JSON.stringify(attestation, null, 2);
        await navigator.clipboard.writeText(attestationJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = () => {
        const text = `My Kite Credit Score: ${attestation.kite_score}/1000 (${attestation.tier} tier)\n\nVerified attributes: ${attestation.verified_attributes.join(", ")}\nProof: ${attestation.proof}\n\n#KiteCredit #DeFi`;

        if (navigator.share) {
            navigator.share({ text }).catch(() => { });
        } else {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="bg-slate-900/80 backdrop-blur border border-white/5 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white font-outfit">
                    ZK Attestation
                </h3>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-medium">
                    v{attestation.version}
                </span>
            </div>

            {/* Attestation details */}
            <div className="bg-slate-800/50 border border-white/5 rounded-xl p-5 font-mono text-xs space-y-2 mb-6">
                <div className="flex justify-between">
                    <span className="text-slate-500">score</span>
                    <span className="text-white">{attestation.kite_score}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">tier</span>
                    <span className="text-white">{attestation.tier}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">proof</span>
                    <span className="text-sky-400 break-all">{attestation.proof}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">issued</span>
                    <span className="text-slate-300">
                        {new Date(attestation.issued_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>
                <div className="pt-2 border-t border-white/5">
                    <span className="text-slate-500">verified attributes</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {attestation.verified_attributes.map((attr) => (
                            <span
                                key={attr}
                                className="px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded text-[10px]"
                            >
                                {attr}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCopy}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-xl py-2.5 text-sm text-slate-300 font-medium transition-colors cursor-pointer"
                >
                    {copied ? "✓ Copied" : "Copy JSON"}
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleShare}
                    className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-xl py-2.5 text-sm text-white font-medium transition-all cursor-pointer"
                >
                    Share Attestation
                </motion.button>
            </div>
        </div>
    );
}
