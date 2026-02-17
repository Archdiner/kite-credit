"use client";

import Image from "next/image";
import { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

export default function ParallaxKites() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"],
    });

    const y1 = useTransform(scrollYProgress, [0, 1], [0, -200]); // Fast
    const y2 = useTransform(scrollYProgress, [0, 1], [0, -100]); // Medium
    const y3 = useTransform(scrollYProgress, [0, 1], [0, -50]);  // Slow

    const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 10]);
    const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -5]);

    return (
        <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none h-screen overflow-hidden">
            {/* Kite 1 - Foreground, fast */}
            <motion.div style={{ y: y1, rotate: rotate1 }} className="absolute top-1/4 left-10 w-24 h-24 md:w-32 md:h-32 opacity-90">
                <Image
                    src="/assets/kite_1.png"
                    alt="Kite"
                    width={128}
                    height={128}
                    className="w-full h-full object-contain drop-shadow-lg"
                />
            </motion.div>

            {/* Kite 2 - Midground, delayed */}
            <motion.div style={{ y: y2, rotate: rotate2 }} className="absolute top-1/3 right-10 md:right-32 w-48 h-48 md:w-64 md:h-64 opacity-95">
                <Image
                    src="/assets/kite_2.png"
                    alt="Kite"
                    width={256}
                    height={256}
                    className="w-full h-full object-contain drop-shadow-xl"
                />
            </motion.div>

            {/* Kite 3 - Background, slow, small */}
            <motion.div style={{ y: y3 }} className="absolute top-1/5 left-1/3 w-12 h-12 md:w-16 md:h-16 opacity-80 blur-[1px]">
                <Image
                    src="/assets/kite_1.png"
                    alt="Kite"
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                />
            </motion.div>
        </div>
    );
}
