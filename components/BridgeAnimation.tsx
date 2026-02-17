"use client";

import { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

export default function BridgeAnimation() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    // Map scroll progress to text offset
    // Start off-screen (-100%) and move to end (100%)
    const startOffset = useTransform(scrollYProgress, [0, 1], ["-20%", "120%"]);

    return (
        <div ref={containerRef} className="relative w-full h-64 md:h-96 overflow-hidden flex items-center justify-center my-12">
            <svg className="w-full h-full absolute inset-0" viewBox="0 0 1000 400" preserveAspectRatio="none">
                {/* Bridge Path - simple arch */}
                <path
                    id="bridge-path"
                    d="M0,400 Q500,100 1000,400"
                    fill="transparent"
                    stroke="url(#gradient)"
                    strokeWidth="2"
                    className="opacity-50"
                />
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4CA1AF" />
                        <stop offset="100%" stopColor="#FF9A8B" />
                    </linearGradient>
                </defs>

                <text className="text-xl md:text-3xl font-bold fill-city-teal-dark tracking-widest uppercase">
                    <motion.textPath
                        href="#bridge-path"
                        startOffset={startOffset}
                        style={{ fill: "url(#gradient)" }}
                    >
                        Converting On-Chain History to Global Reputation •
                        Converting On-Chain History to Global Reputation •
                    </motion.textPath>
                </text>
            </svg>

            {/* Decorative 'Structure' of bridge */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('/assets/grid.svg')] bg-center mask-image-gradient" />
        </div>
    );
}
