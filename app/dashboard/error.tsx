"use client";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
            <div className="max-w-md text-center space-y-5">
                <div className="w-14 h-14 bg-red-500/20 border border-red-500/30 rotate-45 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Dashboard Error</h2>
                <p className="text-sm text-white/50 leading-relaxed">
                    {error.message || "Something went wrong loading your dashboard."}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-6 py-2.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 rounded-lg text-sm font-medium hover:bg-sky-500/30 transition-colors"
                    >
                        Try Again
                    </button>
                    <a
                        href="/"
                        className="px-6 py-2.5 bg-white/10 border border-white/20 text-white/70 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                    >
                        Go Home
                    </a>
                </div>
            </div>
        </div>
    );
}
