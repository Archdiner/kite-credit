import Image from "next/image";
import ParallaxKites from "@/components/ParallaxKites";
import BridgeAnimation from "@/components/BridgeAnimation";

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden font-sans">
      {/* Hero Section */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/assets/city_background.png"
            alt="Sunset City Skyline"
            fill
            className="object-cover object-center"
            priority
          />
          {/* Overlay for text readability (optional, keeping it subtle as per 'clean' req) */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-pink/20 to-transparent mix-blend-overlay" />
        </div>

        {/* Animated Kites (Parallax) */}
        <ParallaxKites />

        {/* Hero Content */}
        <div className="relative z-20 text-center max-w-4xl px-6">
          <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-md mb-6 tracking-tight">
            Lift the Floor.
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light drop-shadow-sm mb-8 max-w-2xl mx-auto">
            A decentralized credit protocol turning your on-chain history into a portable global reputation.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-white/90 text-city-teal-dark font-semibold rounded-full hover:bg-white transition shadow-lg backdrop-blur-sm cursor-pointer hover:scale-105 active:scale-95">
              Launch App
            </button>
            <button className="px-8 py-3 bg-city-teal-dark/80 text-white font-semibold rounded-full hover:bg-city-teal-dark transition shadow-lg backdrop-blur-sm cursor-pointer hover:scale-105 active:scale-95">
              View Roadmap
            </button>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 bg-gradient-to-b from-white to-sky-pink/10 text-city-teal-dark relative overflow-hidden">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-12 text-city-teal-dark">
            Bridging the <span className="text-sunset-orange">Credit Gap</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="text-left space-y-6">
              <div className="p-8 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-white">
                <h3 className="text-xl font-bold text-sunset-orange mb-2">The Problem</h3>
                <p className="text-lg text-city-teal-dark/80 leading-relaxed">
                  45 million immigrants lose their credit history when moving countries. 1.7 billion people are "credit invisible."
                </p>
              </div>
              <div className="p-8 bg-white rounded-2xl shadow-xl border-l-4 border-city-teal-light transform md:translate-x-4">
                <h3 className="text-xl font-bold text-city-teal-light mb-2">The Solution</h3>
                <p className="text-lg text-city-teal-dark leading-relaxed">
                  Kite Credit bridges this gap by turning on-chain activity and verified off-chain data into a portable <strong>Reputation Score</strong>.
                </p>
              </div>
            </div>
            <div className="relative w-full">
              <BridgeAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-24 bg-city-teal-dark text-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-bold mb-16 text-center">
            The <span className="text-sky-pink">Platform</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition duration-300">
              <div className="h-12 w-12 bg-sunset-orange rounded-lg mb-6 flex items-center justify-center text-2xl">
                📊
              </div>
              <h3 className="text-2xl font-bold mb-4">Multi-Source Data</h3>
              <p className="text-gray-300 leading-relaxed">
                Ingests on-chain activity (staking, repayment) and off-chain data (via Plaid) without storing sensitive info.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="p-8 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition duration-300">
              <div className="h-12 w-12 bg-kite-blue rounded-lg mb-6 flex items-center justify-center text-2xl">
                🤖
              </div>
              <h3 className="text-2xl font-bold mb-4">Reputation Engine</h3>
              <p className="text-gray-300 leading-relaxed">
                ZK Proofs issue "Credit Attestations" while our Explainable AI Dashboard clarifies score changes.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="p-8 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition duration-300">
              <div className="h-12 w-12 bg-kite-yellow rounded-lg mb-6 flex items-center justify-center text-2xl">
                🪁
              </div>
              <h3 className="text-2xl font-bold mb-4">Token Flywheel</h3>
              <p className="text-gray-300 leading-relaxed">
                Stake $KITE to vouch for others. Institutions pay fee in $KITE to query scores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-24 bg-white text-city-teal-dark">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-bold mb-16 text-center">
            Flight <span className="text-city-teal-light">Plan</span>
          </h2>
          <div className="max-w-4xl mx-auto space-y-8 relative">
            {/* Vertical Line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 -z-10" />

            {/* Day 1 */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="hidden md:block w-1/2 text-right pr-12">
                <h3 className="text-2xl font-bold text-sunset-orange">Day 1: The Launch</h3>
                <p className="text-gray-600 mt-2">Launch $KITE on Pump.fun & Buyback</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-sunset-orange border-4 border-white shadow flex-shrink-0 z-10" />
              <div className="w-full md:w-1/2 pl-12 md:pl-12">
                <div className="md:hidden">
                  <h3 className="text-xl font-bold text-sunset-orange">Day 1: The Launch</h3>
                  <p className="text-gray-600 mt-1">Launch $KITE on Pump.fun & Buyback</p>
                </div>
              </div>
            </div>

            {/* Day 2 */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="order-2 md:order-1 w-full md:w-1/2 text-right pr-12 md:pr-12">
                <div className="md:hidden pl-12">
                  <h3 className="text-xl font-bold text-kite-blue">Day 2: Build In Public</h3>
                  <p className="text-gray-600 mt-1">Live Stream & Credit Scanner Logic</p>
                </div>
              </div>
              <div className="order-1 md:order-2 w-8 h-8 rounded-full bg-kite-blue border-4 border-white shadow flex-shrink-0 z-10" />
              <div className="order-3 w-full md:w-1/2 pl-12 md:pl-12">
                <div className="hidden md:block">
                  <h3 className="text-2xl font-bold text-kite-blue">Day 2: Build In Public</h3>
                  <p className="text-gray-600 mt-2">Live Stream & Credit Scanner Logic</p>
                </div>
              </div>
            </div>

            {/* Day 3 */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="hidden md:block w-1/2 text-right pr-12">
                <h3 className="text-2xl font-bold text-city-teal-light">Day 3: MVP</h3>
                <p className="text-gray-600 mt-2">Deploy Landing Page & Submit Pitch</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-city-teal-light border-4 border-white shadow flex-shrink-0 z-10" />
              <div className="w-full md:w-1/2 pl-12 md:pl-12">
                <div className="md:hidden">
                  <h3 className="text-xl font-bold text-city-teal-light">Day 3: MVP</h3>
                  <p className="text-gray-600 mt-1">Deploy Landing Page & Submit Pitch</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-city-teal-dark border-t border-white/10 text-center text-white/40">
        <p>© 2026 Kite Credit. Built for the Pump.fun Global Hackathon.</p>
      </footer>
    </main>
  );
}
