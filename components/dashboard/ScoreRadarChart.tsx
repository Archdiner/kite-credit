"use client";

import { motion } from "framer-motion";
import type { FiveFactorBreakdown } from "@/types";

interface ScoreRadarChartProps {
    breakdown: FiveFactorBreakdown;
}

export default function ScoreRadarChart({ breakdown }: ScoreRadarChartProps) {
    const { paymentHistory, utilization, creditAge, creditMix, newCredit } = breakdown;

    // Normalize values to 0-1 range for plotting
    const data = [
        { label: "Payment", value: paymentHistory.score / 350, max: 350 },
        { label: "Utilization", value: utilization.score / 300, max: 300 },
        { label: "Age", value: creditAge.score / 150, max: 150 },
        { label: "Mix", value: creditMix.score / 100, max: 100 },
        { label: "New", value: newCredit.score / 100, max: 100 },
    ];

    // SVG Config
    const size = 300;
    const center = size / 2;
    const radius = 100;
    const sides = 5;

    // Helper to calculate point coordinates
    const getPoint = (index: number, value: number) => {
        const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
        const x = center + radius * value * Math.cos(angle);
        const y = center + radius * value * Math.sin(angle);
        return `${x},${y}`;
    };

    const polygonPoints = data.map((d, i) => getPoint(i, d.value)).join(" ");
    const fullPolyPoints = data.map((_, i) => getPoint(i, 1)).join(" ");

    // Grid levels (25%, 50%, 75%, 100%)
    const gridLevels = [0.25, 0.5, 0.75, 1];

    return (
        <div className="relative w-full aspect-square max-w-[300px] mx-auto">
            <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {/* Background Grid */}
                {gridLevels.map((level) => (
                    <polygon
                        key={level}
                        points={data.map((_, i) => getPoint(i, level)).join(" ")}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="1"
                    />
                ))}

                {/* Axes */}
                {data.map((_, i) => {
                    const end = getPoint(i, 1);
                    return (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={end.split(",")[0]}
                            y2={end.split(",")[1]}
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Data Polygon */}
                <motion.polygon
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 0.8, scale: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    points={polygonPoints}
                    fill="rgba(20, 184, 166, 0.2)" // Emerald/Teal tint
                    stroke="url(#gradient)"
                    strokeWidth="2"
                    className="drop-shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                />

                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" /> {/* Emerald */}
                        <stop offset="100%" stopColor="#6366f1" /> {/* Indigo */}
                    </linearGradient>
                </defs>

                {/* Labels */}
                {data.map((d, i) => {
                    const [x, y] = getPoint(i, 1.2).split(",").map(Number);
                    return (
                        <text
                            key={i}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="rgba(255, 255, 255, 0.6)"
                            fontSize="10"
                            fontWeight="bold"
                            className="uppercase tracking-widest"
                        >
                            {d.label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}
