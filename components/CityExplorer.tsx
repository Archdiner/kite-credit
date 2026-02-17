"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

// Define the types for our city sections
type SectionId = "overview" | "mission" | "engine" | "vision";

interface CitySection {
    id: SectionId;
    title: string;
    subtitle: string;
    x: number; // Percentage position (0-100)
    y: number; // Percentage position (0-100)
    zoom: number; // Scale factor when zoomed in,
    color: string;
}

const sections: Record<string, CitySection> = {
    mission: {
        id: "mission",
        title: "Lifting the Floor",
        subtitle: "The Border Fix",
        x: 20,
        y: 60,
        zoom: 3,
        color: "from-orange-500 to-amber-500", // Sunset/Warm
    },
    engine: {
        id: "engine",
        title: "The Reputation Engine",
        subtitle: "Portable Equity",
        x: 50,
        y: 45, // Moved down slightly to avoid covering title
        zoom: 3,
        color: "from-sky-500 to-blue-600", // Kite Blue
    },
    vision: {
        id: "vision",
        title: "Identity in Flight",
        subtitle: "Global Fluidity",
        x: 80,
        y: 60,
        zoom: 3,
        color: "from-indigo-500 to-violet-600", // Deep Sky
    },
};

export default function CityExplorer() {
    const [activeSection, setActiveSection] = useState<SectionId>("overview");
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [isLaunched, setIsLaunched] = useState(false);

    useEffect(() => {
        // Target: 3pm EST February 17th 2026
        // EST is UTC-5. 3pm is 15:00.
        // ISO string for 2026-02-17 15:00:00 EST (-05:00)
        const targetDate = new Date("2026-02-17T15:00:00-05:00").getTime();

        const calculateTime = () => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                setIsLaunched(true);
                return;
            }

            // We only care about hours/mins/seconds for the immediate display if it's within 24h, 
            // but let's handle days if needed (though request implies it's soon-ish or specific)
            // User asked for "ends at", usually implies a countdown. 
            // Let's show Hours:Minutes:Seconds. If > 24h, we include days in hours? 
            // Or just Days Hours Minutes Seconds.
            // Let's stick to a standard breakdown.

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // If days > 0, add them to hours for a simpler display or show days?
            // Let's just pass the raw values and format in render.
            // Actually simpler state:
            setTimeLeft({
                hours: hours + (days * 24),
                minutes,
                seconds
            });
        };

        calculateTime(); // Initial call
        const interval = setInterval(calculateTime, 1000);

        return () => clearInterval(interval);
    }, []);

    // Calculate the transform origin and scale based on the active section
    const getVariants = () => {
        if (activeSection === "overview") {
            return {
                x: "0%",
                y: "0%",
                scale: 1,
                transition: { duration: 1.5, ease: "easeInOut" as const },
            };
        }

        const section = sections[activeSection];
        // Center the target point on the screen and scale up
        const x = (50 - section.x) * section.zoom;
        const y = (50 - section.y) * section.zoom;

        return {
            x: `${x}vw`,
            y: `${y}vh`,
            scale: section.zoom,
            transition: { duration: 1.5, ease: "easeInOut" as const },
        };
    };

    const renderContent = () => {
        switch (activeSection) {
            case "mission":
                return (
                    <div className="flex flex-col items-center max-w-4xl w-full">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                            className="text-center mb-12"
                        >
                            <h2 className="text-6xl md:text-8xl font-bold text-white mb-4 tracking-tighter drop-shadow-lg">
                                LIFT THE FLOOR
                            </h2>
                            <div className="h-1 w-32 bg-orange-500 mx-auto rounded-full shadow-[0_0_10px_rgba(249,115,22,0.6)]" />
                        </motion.div>

                        <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.8, duration: 0.8 }}
                                className="bg-slate-900/90 backdrop-blur-md p-8 rounded-xl border-l-4 border-orange-500 shadow-2xl"
                            >
                                <h3 className="text-2xl font-bold text-orange-100 mb-2 uppercase tracking-widest flex items-center gap-3">
                                    <div className="w-2 h-2 rotate-45 bg-orange-500" /> The Problem
                                </h3>
                                <p className="text-lg text-white leading-relaxed font-light">
                                    Credit is a <span className="font-bold text-orange-200">walled garden</span>. When you move, your financial soul stays behind. You start from zero, grounded by borders.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1.0, duration: 0.8 }}
                                className="bg-white/95 backdrop-blur-md p-8 rounded-xl border-r-4 border-blue-500 text-right shadow-2xl text-slate-900"
                            >
                                <h3 className="text-2xl font-bold text-blue-900 mb-2 uppercase tracking-widest flex items-center justify-end gap-3">
                                    The Solution <div className="w-2 h-2 rotate-45 bg-blue-500" />
                                </h3>
                                <p className="text-lg text-slate-800 leading-relaxed font-medium">
                                    <span className="text-blue-600 font-bold">Portable Equity.</span> A persistent reputation that flies with you. Your history is owned by you, not the bank.
                                </p>
                            </motion.div>
                        </div>
                    </div>
                );

            case "engine":
                return (
                    <div className="flex flex-col items-center max-w-6xl w-full">
                        <motion.h2
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 }}
                            className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tight text-center drop-shadow-xl"
                        >
                            THE REPUTATION ENGINE
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="text-xl text-sky-100 mb-12 font-light tracking-wide"
                        >
                            We build your universal credit score using:
                        </motion.p>

                        <div className="grid md:grid-cols-2 gap-8 w-full px-8">
                            {[
                                {
                                    title: "On-Chain",
                                    desc: "Aggregating wallet behavior, staking history, and liquidity depth to prove financial reliability without revealing your identity.",
                                    bg: "bg-slate-900/95",
                                    border: "border-blue-500",
                                    accent: "text-blue-400",
                                    icon: "🔷",
                                    delay: 0.7
                                },
                                {
                                    title: "Off-Chain",
                                    desc: "Integrating real-world cash flow data via Plaid to bridge traditional finance with decentralized credit.",
                                    bg: "bg-orange-900/90",
                                    border: "border-orange-500",
                                    accent: "text-orange-300",
                                    icon: "🌍",
                                    delay: 0.9
                                }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: item.delay, duration: 0.6 }}
                                    className={`relative ${item.bg} p-8 rounded-lg border-t-4 ${item.border} shadow-2xl hover:-translate-y-2 transition-transform duration-300 group overflow-hidden`}
                                >
                                    {/* Kite Watermark */}
                                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rotate-12 opacity-5 border-4 border-white pointer-events-none transform group-hover:scale-110 transition-transform" />

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className={`w-3 h-3 rotate-45 ${item.border.replace('border', 'bg')}`} />
                                        <h3 className="text-2xl font-bold text-white tracking-wide">{item.title}</h3>
                                    </div>

                                    <p className="text-gray-100 font-light leading-relaxed text-lg min-h-[4rem]">{item.desc}</p>

                                    <div className={`mt-6 h-px w-full bg-gradient-to-r from-transparent via-${item.accent.split('-')[1]}-500/50 to-transparent`} />
                                </motion.div>
                            ))}
                        </div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5 }}
                            className="mt-16 flex items-center gap-4 bg-emerald-900/80 px-8 py-4 rounded-full border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-md"
                        >
                            <div className="relative w-3 h-3">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                            <span className="text-sm font-bold tracking-widest text-emerald-100 uppercase">ZK-Proof Privacy Shield Active</span>
                        </motion.div>
                    </div>
                );

            case "vision":
                return (
                    <div className="flex flex-col items-center text-center max-w-4xl px-4">
                        <motion.div
                            initial={{ opacity: 0, filter: "blur(10px)" }}
                            animate={{ opacity: 1, filter: "blur(0px)" }}
                            transition={{ delay: 0.5, duration: 1 }}
                            className="relative"
                        >
                            <h2 className="text-6xl md:text-9xl font-bold text-white mb-8 drop-shadow-2xl">
                                IDENTITY IN FLIGHT
                            </h2>
                            {/* Decorative line simulating a kite string */}
                            <div className="absolute left-1/2 -top-24 w-px h-24 bg-gradient-to-b from-transparent to-white/50 -translate-x-1/2" />
                        </motion.div>

                        <div className="flex flex-wrap justify-center gap-6 mb-16">
                            {["Global Nomad", "International Student", "Credit Invisible", "DeFi Native"].map((tag, i) => (
                                <motion.div
                                    key={tag}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1 + (i * 0.1) }}
                                    className="relative group"
                                >
                                    <div className="absolute inset-0 bg-white/10 rotate-3 group-hover:rotate-6 transition-transform rounded-sm" />
                                    <div className="relative px-8 py-3 bg-white text-slate-900 font-bold tracking-wider uppercase text-sm shadow-xl hover:-translate-y-1 transition-transform cursor-default">
                                        {tag}
                                    </div>
                                    {/* Tiny kite diamond on top */}
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-sky-400 rotate-45" />
                                </motion.div>
                            ))}
                        </div>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2 }}
                            className="text-2xl text-white font-light max-w-3xl leading-relaxed drop-shadow-md"
                        >
                            Stop starting from zero. We are building a world where your reputation allows you to <span className="font-bold text-sky-300">land anywhere</span> and <span className="font-bold text-orange-300">immediately take off</span>.
                        </motion.p>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-slate-900 font-sans">
            {/* Background Layer - The City */}
            <motion.div
                className="absolute inset-0 w-full h-full origin-center"
                animate={getVariants()}
            >
                <div className="relative w-full h-full">
                    <Image
                        src="/city_background.png"
                        alt="City Background"
                        fill
                        className="object-cover object-center"
                        priority
                        quality={100}
                    />

                    {/* Hotspots - Only visible in overview */}
                    <AnimatePresence>
                        {activeSection === "overview" && (
                            <>
                                <motion.div
                                    className="absolute top-[8%] left-0 w-full text-center z-0 pointer-events-none"
                                    initial={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -50 }}
                                    transition={{ duration: 0.8 }}
                                >
                                    <p className="text-[10px] md:text-lg text-sky-100 font-mono mb-4 md:mb-6 tracking-[0.2em] md:tracking-[0.4em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-bold">
                                        Decentralized International Credit Protocol
                                    </p>
                                    <h1 className="text-4xl md:text-9xl font-black text-white tracking-tighter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] mb-4">
                                        KITE CREDIT
                                    </h1>
                                    <div className="h-1 w-20 md:w-32 bg-sky-400 mx-auto rounded-full mt-2 md:mt-4 mb-2 md:mb-4 shadow-[0_0_15px_rgba(56,189,248,0.8)]" />

                                    <p className="text-lg md:text-3xl text-white font-light tracking-[0.2em] uppercase italic drop-shadow-md whitespace-nowrap mt-2">
                                        Identity in Flight
                                    </p>
                                </motion.div>

                                {Object.values(sections).map((section) => (
                                    <motion.button
                                        key={section.id}
                                        className="absolute w-20 h-20 -ml-10 -mt-10 rounded-full bg-slate-900/40 backdrop-blur-sm border-2 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)] z-10 flex items-center justify-center group cursor-pointer hover:border-sky-400 transition-colors"
                                        style={{ left: `${section.x}%`, top: `${section.y}%` }}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0 }}
                                        whileHover={{ scale: 1.15 }}
                                        onClick={() => setActiveSection(section.id as SectionId)}
                                    >
                                        <div className={`absolute inset-0 rounded-full bg-gradient-to-tr ${section.color} opacity-30 group-hover:opacity-60 blur-md transition-opacity`} />

                                        {/* Diamond shape for Kite feel */}
                                        <div className="w-6 h-6 bg-white rotate-45 relative z-10 shadow-lg group-hover:rotate-90 transition-transform duration-500" />

                                        <div className="absolute top-full mt-5 flex flex-col items-center pointer-events-none">
                                            <span className="text-white text-sm font-bold tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] whitespace-nowrap opacity-90 group-hover:opacity-100 transition-opacity bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                                                {section.title}
                                            </span>
                                        </div>
                                    </motion.button>
                                ))}

                                {/* Countdown Timer - Responsive Position */}
                                <motion.div
                                    className="absolute transform -translate-x-1/2 flex items-center justify-center pointer-events-none z-0 left-1/2 bottom-[15%] md:top-[63%] md:bottom-auto"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ delay: 0.5 }}
                                >
                                    <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 md:px-6 md:py-2 rounded-full flex gap-3 shadow-2xl">
                                        {!isLaunched ? (
                                            <>
                                                <span className="text-sky-300 font-mono text-xs md:text-sm tracking-widest uppercase self-center">Liftoff In:</span>
                                                <div className="flex gap-2 font-mono text-lg md:text-xl text-white font-bold">
                                                    <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
                                                    <span className="opacity-50">:</span>
                                                    <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
                                                    <span className="opacity-50">:</span>
                                                    <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-emerald-400 font-mono text-sm md:text-lg tracking-widest uppercase font-bold animate-pulse">
                                                PROTOCOL LAUNCHED
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Content Overlay - Logic when zoomed in */}
            <AnimatePresence mode="wait">
                {activeSection !== "overview" && (
                    <motion.div
                        key="content-overlay"
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 md:p-12 pointer-events-none"
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(12px)", transition: { duration: 1 } }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)", transition: { duration: 0.5 } }}
                    >
                        {/* Darker overlay for better text contrast */}
                        <div className="absolute inset-0 bg-black/40" />

                        <div className="pointer-events-auto w-full flex flex-col items-center z-10">
                            {renderContent()}

                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 2, duration: 0.5 }}
                                onClick={() => setActiveSection("overview")}
                                className="mt-16 px-10 py-4 bg-white text-slate-900 hover:bg-sky-50 text-sm font-bold tracking-[0.2em] rounded-sm uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] relative overflow-hidden group"
                            >
                                <span className="relative z-10">Return to City</span>
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
