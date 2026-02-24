"use client";

// ---------------------------------------------------------------------------
// /lender — Lender Dashboard
// ---------------------------------------------------------------------------
// Authenticated dashboard for lenders to manage API keys, webhooks, and
// view delivery logs. Requires a valid API key (from /api/lender/register).
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { LenderDashboardData, LenderWebhook, WebhookDelivery } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "overview" | "apikey" | "webhooks" | "docs";

const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "apikey", label: "API Key" },
    { key: "webhooks", label: "Webhooks" },
    { key: "docs", label: "Docs" },
];

const SESSION_KEY = "kite_lender_key";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function truncateWallet(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function apiFetch<T>(
    path: string,
    apiKey: string,
    options?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string }> {
    try {
        const res = await fetch(path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                ...(options?.headers ?? {}),
            },
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            return { ok: false, error: json.error ?? `HTTP ${res.status}` };
        }
        return { ok: true, data: json.data as T };
    } catch {
        return { ok: false, error: "Network error" };
    }
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function LenderDashboardPage() {
    const [apiKey, setApiKey] = useState("");
    const [lender, setLender] = useState<LenderDashboardData | null>(null);
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);
    const [tab, setTab] = useState<Tab>("overview");

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------

    const authenticate = async (key: string) => {
        setAuthLoading(true);
        setAuthError("");
        const { ok, data, error } = await apiFetch<LenderDashboardData>(
            "/api/lender/auth",
            key,
            { method: "POST" }
        );
        setAuthLoading(false);
        if (ok && data) {
            setLender(data);
            setApiKey(key);
            sessionStorage.setItem(SESSION_KEY, key);
        } else {
            setAuthError(error ?? "Authentication failed");
            sessionStorage.removeItem(SESSION_KEY);
        }
    };

    useEffect(() => {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) {
            const restoreSession = async () => {
                setAuthLoading(true);
                const { ok, data } = await apiFetch<LenderDashboardData>(
                    "/api/lender/auth",
                    stored,
                    { method: "POST" }
                );
                setAuthLoading(false);
                if (ok && data) {
                    setLender(data);
                    setApiKey(stored);
                } else {
                    sessionStorage.removeItem(SESSION_KEY);
                }
            };
            restoreSession();
        }
    }, []);

    const signOut = () => {
        setLender(null);
        setApiKey("");
        setAuthError("");
        setTab("overview");
        sessionStorage.removeItem(SESSION_KEY);
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div className="relative min-h-screen overflow-hidden font-sans bg-slate-950">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                <Image
                    src="/city_background.png"
                    alt=""
                    fill
                    className="object-cover object-center opacity-40"
                    priority
                    quality={80}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950" />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                {/* Nav */}
                <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-sky-400 rotate-45 shadow-[0_0_12px_rgba(56,189,248,0.5)]" />
                        <span className="text-sm font-bold text-white tracking-wider uppercase">
                            Kite Credit
                        </span>
                    </Link>
                    {lender ? (
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/60 font-mono">
                                {lender.name ?? lender.key_prefix}
                            </span>
                            <button
                                onClick={signOut}
                                className="text-[11px] text-white/40 font-mono tracking-wider hover:text-white/70 transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/lend"
                            className="text-[11px] text-white/40 font-mono tracking-wider hover:text-white/70 transition-colors"
                        >
                            Verify a Score →
                        </Link>
                    )}
                </nav>

                <main className="flex-1 flex flex-col items-center px-4 py-8">
                    <AnimatePresence mode="wait">
                        {!lender ? (
                            <LoginScreen
                                key="login"
                                onAuth={authenticate}
                                loading={authLoading}
                                error={authError}
                            />
                        ) : (
                            <Dashboard
                                key="dashboard"
                                lender={lender}
                                apiKey={apiKey}
                                tab={tab}
                                setTab={setTab}
                                onLenderUpdate={setLender}
                                onKeyChange={(newKey) => {
                                    setApiKey(newKey);
                                    sessionStorage.setItem(SESSION_KEY, newKey);
                                }}
                            />
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Login Screen
// ---------------------------------------------------------------------------

function LoginScreen({
    onAuth,
    loading,
    error,
}: {
    onAuth: (key: string) => void;
    loading: boolean;
    error: string;
}) {
    const [key, setKey] = useState("");

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md space-y-6 mt-24"
        >
            <div className="text-center space-y-3">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Lender Dashboard
                </p>
                <h1 className="text-3xl font-black text-white tracking-tight">
                    Sign In
                </h1>
                <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
                    Paste your API key to access your lender dashboard.
                </p>
            </div>

            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && key.trim()) onAuth(key.trim());
                    }}
                    placeholder="kite_xxxxxxxx..."
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 font-mono focus:outline-none focus:border-sky-500/50 transition-colors"
                    spellCheck={false}
                    autoComplete="off"
                />
                <button
                    onClick={() => key.trim() && onAuth(key.trim())}
                    disabled={loading || !key.trim()}
                    className="w-full px-6 py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/30 disabled:cursor-not-allowed text-white font-bold tracking-wider uppercase text-xs rounded-lg transition-colors"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Authenticating
                        </span>
                    ) : (
                        "Authenticate"
                    )}
                </button>

                {error && (
                    <p className="text-xs text-red-400 font-mono text-center">{error}</p>
                )}

                <p className="text-[10px] text-white/20 font-mono text-center">
                    Need an API key?{" "}
                    <Link href="/lend" className="text-sky-400/60 hover:text-sky-400 transition-colors">
                        Register via the API
                    </Link>
                </p>
            </div>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard({
    lender,
    apiKey,
    tab,
    setTab,
    onLenderUpdate,
    onKeyChange,
}: {
    lender: LenderDashboardData;
    apiKey: string;
    tab: Tab;
    setTab: (t: Tab) => void;
    onLenderUpdate: (l: LenderDashboardData) => void;
    onKeyChange: (key: string) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl space-y-6"
        >
            {/* Tab bar */}
            <div className="flex gap-6 border-b border-white/8">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`pb-3 text-[11px] font-mono tracking-wider uppercase transition-colors ${
                            tab === t.key
                                ? "border-b-2 border-sky-400 text-white"
                                : "text-white/30 hover:text-white/60"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
                {tab === "overview" && (
                    <TabOverview key="overview" lender={lender} setTab={setTab} />
                )}
                {tab === "apikey" && (
                    <TabApiKey
                        key="apikey"
                        lender={lender}
                        apiKey={apiKey}
                        onLenderUpdate={onLenderUpdate}
                        onKeyChange={onKeyChange}
                    />
                )}
                {tab === "webhooks" && (
                    <TabWebhooks key="webhooks" apiKey={apiKey} onLenderUpdate={onLenderUpdate} lender={lender} />
                )}
                {tab === "docs" && <TabDocs key="docs" />}
            </AnimatePresence>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

function TabOverview({
    lender,
    setTab,
}: {
    lender: LenderDashboardData;
    setTab: (t: Tab) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid md:grid-cols-2 gap-4"
        >
            {/* Account card */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Account
                </p>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-mono">Name</span>
                        <span className="text-sm text-white font-medium">
                            {lender.name ?? "—"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-mono">Key Prefix</span>
                        <span className="text-sm text-white/70 font-mono">
                            {lender.key_prefix}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-mono">Status</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                                lender.active
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                            }`}
                        >
                            {lender.active ? "Active" : "Inactive"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-mono">Created</span>
                        <span className="text-xs text-white/50 font-mono">
                            {formatDate(lender.created_at)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-mono">Rate Limit</span>
                        <span className="text-xs text-white/50 font-mono">
                            {lender.rate_limit}/hr
                        </span>
                    </div>
                </div>
            </div>

            {/* Webhooks summary card */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Webhooks
                </p>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-mono">Total</span>
                        <span className="text-2xl font-black text-white">
                            {lender.total_webhooks}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-mono">Active</span>
                        <span className="text-2xl font-black text-emerald-400">
                            {lender.active_webhooks}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setTab("webhooks")}
                    className="text-[10px] text-sky-400/70 font-mono hover:text-sky-400 transition-colors"
                >
                    Manage Webhooks →
                </button>
            </div>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// Tab 2: API Key
// ---------------------------------------------------------------------------

function TabApiKey({
    lender,
    apiKey,
    onLenderUpdate,
    onKeyChange,
}: {
    lender: LenderDashboardData;
    apiKey: string;
    onLenderUpdate: (l: LenderDashboardData) => void;
    onKeyChange: (key: string) => void;
}) {
    const [rotating, setRotating] = useState(false);
    const [confirmRotate, setConfirmRotate] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [rotateError, setRotateError] = useState("");

    const maskedKey = `${lender.key_prefix}${"•".repeat(20)}`;

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRotate = async () => {
        setRotating(true);
        setRotateError("");
        const { ok, data, error } = await apiFetch<{
            api_key: string;
            key_prefix: string;
        }>("/api/lender/rotate-key", apiKey, { method: "POST" });
        setRotating(false);
        setConfirmRotate(false);

        if (ok && data) {
            setNewKey(data.api_key);
            onKeyChange(data.api_key);
            onLenderUpdate({ ...lender, key_prefix: data.key_prefix });
        } else {
            setRotateError(error ?? "Failed to rotate key");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {/* Current key */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Current API Key
                </p>
                <div className="flex items-center gap-3">
                    <code className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white/60 font-mono">
                        {newKey ?? maskedKey}
                    </code>
                    <button
                        onClick={() => handleCopy(newKey ?? lender.key_prefix)}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white/50 font-mono hover:bg-white/10 transition-colors"
                    >
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
                {newKey && (
                    <p className="text-[10px] text-amber-400/80 font-mono">
                        New key shown above. Copy it now — it will not be shown again.
                    </p>
                )}
            </div>

            {/* Rotate key */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Rotate Key
                </p>
                {!confirmRotate ? (
                    <>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <p className="text-[10px] text-amber-300/80 font-mono leading-relaxed">
                                Rotating your key will immediately invalidate the current key.
                                All existing integrations will need to be updated with the new key.
                            </p>
                        </div>
                        <button
                            onClick={() => setConfirmRotate(true)}
                            className="px-5 py-2.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wider uppercase rounded-lg hover:bg-amber-500/30 transition-colors"
                        >
                            Rotate API Key
                        </button>
                    </>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-white/60 font-mono">
                            Are you sure? This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleRotate}
                                disabled={rotating}
                                className="px-5 py-2.5 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold tracking-wider uppercase rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                            >
                                {rotating ? "Rotating..." : "Confirm Rotate"}
                            </button>
                            <button
                                onClick={() => setConfirmRotate(false)}
                                className="px-5 py-2.5 bg-white/5 border border-white/10 text-white/50 text-xs font-mono rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                        {rotateError && (
                            <p className="text-xs text-red-400 font-mono">{rotateError}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Quick-start snippets */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Quick Start
                </p>
                <div className="space-y-4">
                    <CodeBlock
                        label="curl"
                        code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${typeof window !== "undefined" ? window.location.origin : ""}/api/lender/score/WALLET_ADDRESS`}
                    />
                    <CodeBlock
                        label="fetch"
                        code={`const res = await fetch("/api/lender/score/WALLET_ADDRESS", {
  headers: { Authorization: "Bearer YOUR_API_KEY" }
});
const { data } = await res.json();`}
                    />
                    <CodeBlock
                        label="python"
                        code={`import requests

r = requests.get(
    "YOUR_BASE_URL/api/lender/score/WALLET_ADDRESS",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
print(r.json())`}
                    />
                </div>
            </div>
        </motion.div>
    );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/30 font-mono uppercase">{label}</span>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[9px] text-white/20 font-mono hover:text-white/50 transition-colors"
                >
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <pre className="text-[10px] text-white/40 font-mono bg-black/20 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {code}
            </pre>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 3: Webhooks
// ---------------------------------------------------------------------------

function TabWebhooks({
    apiKey,
    lender,
    onLenderUpdate,
}: {
    apiKey: string;
    lender: LenderDashboardData;
    onLenderUpdate: (l: LenderDashboardData) => void;
}) {
    const [webhooks, setWebhooks] = useState<LenderWebhook[]>([]);
    const [loading, setLoading] = useState(true);
    const [createWallet, setCreateWallet] = useState("");
    const [createUrl, setCreateUrl] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchWebhooks = useCallback(async () => {
        const { ok, data } = await apiFetch<{ webhooks: LenderWebhook[] }>(
            "/api/lender/webhooks",
            apiKey
        );
        if (ok && data) setWebhooks(data.webhooks);
        setLoading(false);
    }, [apiKey]);

    useEffect(() => {
        const loadWebhooks = async () => {
            const { ok, data } = await apiFetch<{ webhooks: LenderWebhook[] }>(
                "/api/lender/webhooks",
                apiKey
            );
            if (ok && data) setWebhooks(data.webhooks);
            setLoading(false);
        };
        loadWebhooks();
    }, [apiKey]);

    const handleCreate = async () => {
        if (!createWallet.trim() || !createUrl.trim()) return;
        setCreating(true);
        setCreateError("");

        const { ok, error } = await apiFetch("/api/lender/webhooks", apiKey, {
            method: "POST",
            body: JSON.stringify({
                wallet_address: createWallet.trim(),
                url: createUrl.trim(),
            }),
        });

        setCreating(false);
        if (ok) {
            setCreateWallet("");
            setCreateUrl("");
            fetchWebhooks();
            onLenderUpdate({
                ...lender,
                total_webhooks: lender.total_webhooks + 1,
                active_webhooks: lender.active_webhooks + 1,
            });
        } else {
            setCreateError(error ?? "Failed to create webhook");
        }
    };

    const handleDelete = async (id: string) => {
        const { ok } = await apiFetch(`/api/lender/webhooks/${id}`, apiKey, {
            method: "DELETE",
        });
        if (ok) {
            const deleted = webhooks.find((w) => w.id === id);
            setWebhooks((prev) => prev.filter((w) => w.id !== id));
            onLenderUpdate({
                ...lender,
                total_webhooks: Math.max(0, lender.total_webhooks - 1),
                active_webhooks: deleted?.active
                    ? Math.max(0, lender.active_webhooks - 1)
                    : lender.active_webhooks,
            });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {/* Create form */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Create Webhook
                </p>
                <div className="grid md:grid-cols-2 gap-3">
                    <input
                        type="text"
                        value={createWallet}
                        onChange={(e) => setCreateWallet(e.target.value)}
                        placeholder="Wallet address"
                        className="bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 font-mono focus:outline-none focus:border-sky-500/50 transition-colors"
                        spellCheck={false}
                    />
                    <input
                        type="text"
                        value={createUrl}
                        onChange={(e) => setCreateUrl(e.target.value)}
                        placeholder="https://your-server.com/webhook"
                        className="bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 font-mono focus:outline-none focus:border-sky-500/50 transition-colors"
                        spellCheck={false}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCreate}
                        disabled={creating || !createWallet.trim() || !createUrl.trim()}
                        className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/30 disabled:cursor-not-allowed text-white font-bold tracking-wider uppercase text-xs rounded-lg transition-colors"
                    >
                        {creating ? "Creating..." : "Create"}
                    </button>
                    {createError && (
                        <p className="text-xs text-red-400 font-mono">{createError}</p>
                    )}
                </div>
            </div>

            {/* Webhook list */}
            {loading ? (
                <p className="text-xs text-white/30 font-mono text-center py-8">
                    Loading webhooks...
                </p>
            ) : webhooks.length === 0 ? (
                <div className="bg-white/4 border border-white/8 rounded-2xl p-8 text-center">
                    <p className="text-sm text-white/30 font-mono">No webhooks yet</p>
                    <p className="text-[10px] text-white/15 font-mono mt-1">
                        Create one above to get notified when scores change.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {webhooks.map((wh) => (
                        <WebhookCard
                            key={wh.id}
                            webhook={wh}
                            apiKey={apiKey}
                            expanded={expandedId === wh.id}
                            onToggle={() =>
                                setExpandedId(expandedId === wh.id ? null : wh.id)
                            }
                            onDelete={() => handleDelete(wh.id)}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// Webhook Card (expandable)
// ---------------------------------------------------------------------------

function WebhookCard({
    webhook,
    apiKey,
    expanded,
    onToggle,
    onDelete,
}: {
    webhook: LenderWebhook;
    apiKey: string;
    expanded: boolean;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [loadingDeliveries, setLoadingDeliveries] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        status_code: number | null;
        error: string | null;
    } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [secretVisible, setSecretVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchDeliveries = useCallback(async () => {
        setLoadingDeliveries(true);
        const { ok, data } = await apiFetch<{ deliveries: WebhookDelivery[] }>(
            `/api/lender/webhooks/${webhook.id}/deliveries`,
            apiKey
        );
        if (ok && data) setDeliveries(data.deliveries);
        setLoadingDeliveries(false);
    }, [webhook.id, apiKey]);

    useEffect(() => {
        if (expanded) {
            const loadDeliveries = async () => {
                setLoadingDeliveries(true);
                const { ok, data: result } = await apiFetch<{ deliveries: WebhookDelivery[] }>(
                    `/api/lender/webhooks/${webhook.id}/deliveries`,
                    apiKey
                );
                if (ok && result) setDeliveries(result.deliveries);
                setLoadingDeliveries(false);
            };
            loadDeliveries();
        }
    }, [expanded, webhook.id, apiKey]);

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        const { ok, data } = await apiFetch<{
            status_code: number | null;
            error: string | null;
        }>(`/api/lender/webhooks/${webhook.id}/test`, apiKey, {
            method: "POST",
        });
        setTesting(false);
        if (ok && data) {
            setTestResult(data);
            fetchDeliveries();
        }
    };

    return (
        <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
            {/* Header row */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/2 transition-colors text-left"
            >
                <div className="flex items-center gap-4">
                    <span className="text-sm text-white/70 font-mono">
                        {truncateWallet(webhook.wallet_address)}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono truncate max-w-[200px]">
                        {webhook.url}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {webhook.failure_count > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[9px] font-mono rounded-full border border-amber-500/30">
                            {webhook.failure_count} failures
                        </span>
                    )}
                    <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                            webhook.active
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/15 text-red-400 border border-red-500/30"
                        }`}
                    >
                        {webhook.active ? "Active" : "Disabled"}
                    </span>
                    <svg
                        className={`w-3 h-3 text-white/30 transition-transform ${
                            expanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="border-t border-white/6 px-6 py-4 space-y-4">
                    {/* Secret */}
                    <div className="space-y-1.5">
                        <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
                            Signing Secret
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-black/20 rounded px-3 py-2 text-[10px] text-white/40 font-mono overflow-hidden">
                                {secretVisible
                                    ? webhook.secret
                                    : "•".repeat(40)}
                            </code>
                            <button
                                onClick={() => setSecretVisible(!secretVisible)}
                                className="text-[9px] text-white/20 font-mono hover:text-white/50 transition-colors"
                            >
                                {secretVisible ? "Hide" : "Show"}
                            </button>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(webhook.secret);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                className="text-[9px] text-white/20 font-mono hover:text-white/50 transition-colors"
                            >
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="px-4 py-2 bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:bg-sky-500/30 disabled:opacity-50 transition-colors"
                        >
                            {testing ? "Sending..." : "Send Test"}
                        </button>
                        {!confirmDelete ? (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400/60 text-[10px] font-mono rounded-lg hover:bg-red-500/20 transition-colors"
                            >
                                Delete
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onDelete}
                                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:bg-red-500/30 transition-colors"
                                >
                                    Confirm Delete
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="text-[10px] text-white/30 font-mono hover:text-white/50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Test result */}
                    {testResult && (
                        <div
                            className={`rounded-lg p-3 text-[10px] font-mono ${
                                testResult.error
                                    ? "bg-red-500/10 border border-red-500/20 text-red-300/80"
                                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/80"
                            }`}
                        >
                            {testResult.error
                                ? `Failed: ${testResult.error}`
                                : `Success — HTTP ${testResult.status_code}`}
                        </div>
                    )}

                    {/* Deliveries */}
                    <div className="space-y-2">
                        <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
                            Recent Deliveries
                        </p>
                        {loadingDeliveries ? (
                            <p className="text-[10px] text-white/20 font-mono">Loading...</p>
                        ) : deliveries.length === 0 ? (
                            <p className="text-[10px] text-white/15 font-mono">
                                No deliveries yet
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[10px] font-mono">
                                    <thead>
                                        <tr className="text-white/20 text-left">
                                            <th className="pb-2 pr-4">Event</th>
                                            <th className="pb-2 pr-4">Status</th>
                                            <th className="pb-2 pr-4">Error</th>
                                            <th className="pb-2">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-white/40">
                                        {deliveries.map((d) => (
                                            <tr
                                                key={d.id}
                                                className="border-t border-white/4"
                                            >
                                                <td className="py-2 pr-4">{d.event}</td>
                                                <td className="py-2 pr-4">
                                                    <span
                                                        className={
                                                            d.status_code && d.status_code < 300
                                                                ? "text-emerald-400"
                                                                : "text-red-400"
                                                        }
                                                    >
                                                        {d.status_code ?? "—"}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-4 text-red-400/60">
                                                    {d.error ?? "—"}
                                                </td>
                                                <td className="py-2">
                                                    {formatDate(d.delivered_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 4: Docs (Quick Reference)
// ---------------------------------------------------------------------------

function TabDocs() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {/* Auth format */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-3">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Authentication
                </p>
                <p className="text-[10px] text-white/40 font-mono leading-relaxed">
                    All lender endpoints require a Bearer token in the Authorization header:
                </p>
                <pre className="text-[10px] text-sky-300/60 font-mono bg-black/20 rounded-lg p-3">
                    Authorization: Bearer kite_xxxxxxxx...
                </pre>
            </div>

            {/* Endpoints */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-5">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    API Endpoints
                </p>

                <EndpointDoc
                    method="POST"
                    path="/api/lender/register"
                    description="Register a new lender account and receive an API key."
                    response={`{
  "success": true,
  "data": {
    "api_key": "kite_...",
    "key_prefix": "kite_aBcDeFgH",
    "id": "uuid"
  }
}`}
                />

                <EndpointDoc
                    method="GET"
                    path="/api/lender/score/:address"
                    description="Look up a wallet's Kite Score."
                    response={`{
  "success": true,
  "data": {
    "found": true,
    "score": 742,
    "tier": "Strong",
    "issued_at": "2026-02-22T...",
    "expires_at": "2026-05-23T..."
  }
}`}
                />

                <EndpointDoc
                    method="POST"
                    path="/api/lender/batch"
                    description="Look up scores for up to 50 wallet addresses at once."
                    response={`{
  "success": true,
  "data": {
    "results": [{ "address": "...", "found": true, "score": 742, "tier": "Strong" }],
    "lookup_count": 1
  }
}`}
                />

                <EndpointDoc
                    method="POST"
                    path="/api/lender/webhooks"
                    description="Register a webhook to be notified when a wallet's score changes."
                    response={`{
  "success": true,
  "data": {
    "id": "uuid",
    "wallet_address": "...",
    "url": "https://...",
    "secret": "hex-string",
    "active": true
  }
}`}
                />

                <EndpointDoc
                    method="GET"
                    path="/api/lender/webhooks"
                    description="List all your registered webhooks."
                    response={`{
  "success": true,
  "data": {
    "webhooks": [{ "id": "...", "wallet_address": "...", "url": "...", "active": true }]
  }
}`}
                />

                <EndpointDoc
                    method="DELETE"
                    path="/api/lender/webhooks/:id"
                    description="Delete a webhook subscription."
                    response={`{
  "success": true,
  "data": { "deleted": true, "id": "uuid" }
}`}
                />
            </div>

            {/* Webhook payload format */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-3">
                <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                    Webhook Payload Format
                </p>
                <p className="text-[10px] text-white/40 font-mono leading-relaxed">
                    Webhook deliveries include an HMAC-SHA256 signature in the{" "}
                    <code className="text-sky-300/60">X-Kite-Signature</code> header.
                    Verify it using the webhook secret.
                </p>
                <pre className="text-[10px] text-white/30 font-mono bg-black/20 rounded-lg p-3 leading-relaxed">{`{
  "event": "score.updated",
  "wallet_address": "7xKXtg...",
  "score": 742,
  "tier": "Strong",
  "issued_at": "2026-02-22T...",
  "timestamp": "2026-02-22T..."
}

Headers:
  X-Kite-Signature: sha256=abc123...
  X-Kite-Event: score.updated`}</pre>
            </div>

            {/* Tier thresholds + rate limits */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-3">
                    <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                        Score Tiers
                    </p>
                    <div className="space-y-2 text-[10px] font-mono">
                        <div className="flex justify-between">
                            <span className="text-violet-400">Elite</span>
                            <span className="text-white/40">800–1000</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sky-400">Strong</span>
                            <span className="text-white/40">700–799</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-orange-400">Steady</span>
                            <span className="text-white/40">600–699</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-amber-400">Building</span>
                            <span className="text-white/40">0–599</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-3">
                    <p className="text-[10px] text-sky-400/70 font-mono tracking-[0.25em] uppercase">
                        Rate Limits
                    </p>
                    <div className="space-y-2 text-[10px] font-mono text-white/40 leading-relaxed">
                        <p>Default: <span className="text-white/60">1,000 requests/hour</span></p>
                        <p>Batch: <span className="text-white/60">50 addresses per request</span></p>
                        <p>Webhooks: <span className="text-white/60">10s delivery timeout</span></p>
                        <p>Circuit breaker: <span className="text-white/60">5 consecutive failures disables webhook</span></p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function EndpointDoc({
    method,
    path,
    description,
    response,
}: {
    method: string;
    path: string;
    description: string;
    response: string;
}) {
    const methodColor =
        method === "GET"
            ? "bg-sky-500/20 text-sky-400"
            : method === "POST"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400";

    return (
        <div className="space-y-2 pb-4 border-b border-white/5 last:border-0 last:pb-0">
            <div className="flex items-center gap-2">
                <span
                    className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${methodColor}`}
                >
                    {method}
                </span>
                <code className="text-[10px] text-white/50 font-mono">{path}</code>
            </div>
            <p className="text-[10px] text-white/30 font-mono">{description}</p>
            <pre className="text-[9px] text-white/20 font-mono bg-black/20 rounded p-3 leading-relaxed overflow-x-auto">
                {response}
            </pre>
        </div>
    );
}
