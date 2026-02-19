import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
            <div className="max-w-md text-center space-y-5">
                <div className="w-14 h-14 bg-sky-400/20 border border-sky-400/30 rotate-45 mx-auto" />
                <h1 className="text-5xl font-black text-white">404</h1>
                <p className="text-sm text-white/50">This page doesn&apos;t exist.</p>
                <Link
                    href="/"
                    className="inline-block px-6 py-2.5 bg-white/10 border border-white/20 text-white/70 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                >
                    Go Home
                </Link>
            </div>
        </div>
    );
}
