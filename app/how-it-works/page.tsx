"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

export default function HowItWorksPage() {
    return (
        <div className="relative min-h-screen bg-slate-900 font-sans text-white overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                <Image
                    src="/city_background.png"
                    alt=""
                    fill
                    className="object-cover object-center opacity-20"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-12">
                <header className="flex justify-between items-center mb-16">
                    <Link href="/dashboard" className="flex items-center gap-3 group">
                        <div className="w-5 h-5 bg-sky-400 rotate-45 shadow-[0_0_15px_rgba(56,189,248,0.6)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.8)] transition-all" />
                        <span className="text-xl font-bold tracking-wider uppercase">Kite Credit</span>
                    </Link>
                    <Link href="/dashboard" className="text-sm font-bold text-sky-400 border border-sky-400/30 px-6 py-2 rounded-full hover:bg-sky-400/10 transition-colors uppercase tracking-widest">
                        Check My Score
                    </Link>
                </header>

                <main className="space-y-24">
                    {/* Hero */}
                    <section className="text-center max-w-3xl mx-auto">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-slate-500 mb-6"
                        >
                            THE NEW STANDARD FOR TRUST.
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-lg text-slate-400 leading-relaxed"
                        >
                            Kite Credit replaces opaque credit bureaus with transparent, cryptographic proof of your financial health. We analyze 5 key factors to generate your kite score—owned by you, portable everywhere.
                        </motion.p>
                    </section>

                    {/* The 5 Factors */}
                    <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FactorCard
                            title="Payment History"
                            percent="35%"
                            color="from-emerald-500 to-teal-400"
                            icon="History"
                            desc="Consistency in repaying DeFi loans and regular bank bills. Your strongest predictor of future reliability."
                            delay={0.2}
                        />
                        <FactorCard
                            title="Utilization"
                            percent="30%"
                            color="from-teal-400 to-sky-400"
                            icon="Balance"
                            desc="Healthy collateral ratios and balanced account usage. Shows you don't over-leverage yourself."
                            delay={0.3}
                        />
                        <FactorCard
                            title="Credit Age"
                            percent="15%"
                            color="from-sky-400 to-indigo-400"
                            icon="Time"
                            desc="Longevity of your wallet and bank history. Older accounts demonstrate stability."
                            delay={0.4}
                        />
                        <FactorCard
                            title="Credit Mix"
                            percent="10%"
                            color="from-indigo-400 to-violet-400"
                            icon="Layers"
                            desc="Diversity of protocols and accounts used. Experience with different financial products matters."
                            delay={0.5}
                        />
                        <FactorCard
                            title="New Credit"
                            percent="10%"
                            color="from-violet-400 to-purple-400"
                            icon="Spark"
                            desc="Frequency of new inquiries and account openings. Stability is preferred over rapid expansion."
                            delay={0.6}
                        />
                        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/5 flex flex-col justify-center items-center text-center">
                            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
                                + GitHub Bonus
                            </h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Connect your professional developer identity for up to 50 bonus points. Your code is your currency.
                            </p>
                        </div>
                    </section>

                    {/* How Data is Handled */}
                    <section className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Private by Design. <br />
                                <span className="text-emerald-400">Verifiable by Everyone.</span>
                            </h2>
                            <p className="text-slate-400 leading-relaxed">
                                Traditional scores sell your data. Kite Credit uses <strong>Zero-Knowledge Proofs (ZKPs)</strong> via Reclaim Protocol.
                            </p>
                            <p className="text-slate-400 leading-relaxed">
                                We verify your bank data locally in your browser. Only the mathematical proof of your score is stored on-chain. Your statements never leave your device.
                            </p>
                        </div>
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-sky-500/10" />
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-4 text-sm font-mono text-emerald-300 bg-emerald-900/20 p-3 rounded-lg border border-emerald-500/20">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Proof Generated: 0x7f...3a2b</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm font-mono text-slate-500 bg-slate-800/50 p-3 rounded-lg border border-white/5">
                                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                                    <span>Bank Balance: [HIDDEN]</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm font-mono text-slate-500 bg-slate-800/50 p-3 rounded-lg border border-white/5">
                                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                                    <span>Transaction List: [HIDDEN]</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="mt-24 pt-12 border-t border-white/5 text-center text-slate-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} Kite Credit. Powering the next generation of trust.</p>
                </footer>
            </div>
        </div>
    );
}

function FactorCard({ title, percent, color, desc, delay }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="group hover:-translate-y-1 transition-transform duration-300"
        >
            <div className="h-full bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-colors">
                <div className={`w-12 h-1 bg-gradient-to-r ${color} rounded-full mb-6 group-hover:w-full transition-all duration-500`} />
                <div className="flex justify-between items-baseline mb-4">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <span className={`text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${color} opacity-80`}>{percent}</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                    {desc}
                </p>
            </div>
        </motion.div>
    );
}
