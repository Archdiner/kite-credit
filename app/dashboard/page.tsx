"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMobileWallet } from "@/components/providers/WalletProvider";
import {
    createSession,
    serializeSession,
    buildConnectUrl,
} from "@/lib/phantom-deeplink";
import ScoreDisplay, { type ViewMode } from "@/components/dashboard/ScoreDisplay";
import ScoreBreakdownPanel from "@/components/dashboard/ScoreBreakdownPanel";
import AttestationCard from "@/components/dashboard/AttestationCard";
import ScoreRadarChart from "@/components/dashboard/ScoreRadarChart";
import ShareScoreCard from "@/components/dashboard/ShareScoreCard";
import Link from "next/link";
import type { KiteScore, ZKAttestation } from "@/types";
import { getScoreAge } from "@/lib/freshness";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type FlowState = "connect" | "loading" | "results";

function DashboardContent() {
    const { publicKey, connected, signMessage, wallet, connect, connecting, disconnect } = useWallet();
    const { setVisible } = useWalletModal();
    const {
        isMobile,
        mobileWalletAddress,
        setMobileWalletAddress,
        mobileWalletSignature,
        setMobileWalletSignature,
    } = useMobileWallet();
    const { user, loading: authLoading, signOut, accessToken } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [flowState, setFlowState] = useState<FlowState>("connect");
    const [kiteScore, setKiteScore] = useState<KiteScore | null>(null);
    const [attestation, setAttestation] = useState<ZKAttestation | null>(null);
    const [githubUser, setGithubUser] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [restoringData, setRestoringData] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("crypto");
    const [changingWallet, setChangingWallet] = useState(false);
    const [changingGitHub, setChangingGitHub] = useState(false);
    const [ethAddress, setEthAddress] = useState<string | null>(null);
    const [ethLinking, setEthLinking] = useState(false);
    const [ethError, setEthError] = useState<string | null>(null);
    const [isGithubOnlyScore, setIsGithubOnlyScore] = useState(false);
    const [mobileAddressInput, setMobileAddressInput] = useState("");
    const [mobileAddressError, setMobileAddressError] = useState<string | null>(null);
    const [showManualInput, setShowManualInput] = useState(false);

    const effectiveWalletAddress = isMobile
        ? mobileWalletAddress
        : publicKey?.toBase58() ?? null;
    const isWalletConnected = isMobile ? !!mobileWalletAddress : connected;

    // Auth guard: redirect to /auth if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/auth");
        }
    }, [authLoading, user, router]);

    // Restore data from database on mount
    useEffect(() => {
        if (!user || !accessToken) {
            setRestoringData(false);
            return;
        }

        const restoreData = async () => {
            try {
                const res = await fetch("/api/auth/session", {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();

                if (data.success && data.data) {
                    const { connections, latestScore } = data.data;

                    if (connections) {
                        for (const conn of connections) {
                            if (conn.provider === "github" && conn.provider_user_id) {
                                setGithubUser(conn.provider_user_id);
                            }
                            if (conn.provider === "solana_wallet" && isMobile && conn.provider_user_id) {
                                setMobileWalletAddress(conn.provider_user_id);
                            }
                            if (conn.provider === "ethereum_wallet" && conn.provider_user_id) {
                                setEthAddress(conn.provider_user_id);
                            }
                        }
                    }

                    if (latestScore) {
                        setKiteScore({
                            total: latestScore.total,
                            tier: latestScore.tier,
                            breakdown: latestScore.breakdown,
                            githubBonus: latestScore.githubBonus,
                            explanation: latestScore.explanation,
                            timestamp: latestScore.timestamp,
                        } as KiteScore);
                        if (latestScore.attestation) {
                            setAttestation(latestScore.attestation as ZKAttestation);
                        }
                        setFlowState("results");
                    }
                }
            } catch (err) {
                console.error("[dashboard] Failed to restore data:", err);
            } finally {
                setRestoringData(false);
            }
        };

        restoreData();
    }, [user, accessToken, isMobile, setMobileWalletAddress]);

    // Detect GitHub OAuth return and fetch username
    useEffect(() => {
        const githubStatus = searchParams.get("github");
        const authError = searchParams.get("error");

        if (githubStatus === "connected" && !githubUser) {
            fetch("/api/github/analyze")
                .then(res => res.json())
                .then(data => {
                    const login = data.data?.data?.username || data.data?.data?.login;
                    if (data.success && login) {
                        setGithubUser(login);
                    }
                })
                .catch(() => { /* GitHub is optional */ });
        }

        if (authError) {
            const messages: Record<string, string> = {
                missing_params: "GitHub authorization was incomplete.",
                invalid_state: "GitHub auth session expired. Please try again.",
                token_exchange_failed: "Failed to connect GitHub. Please try again.",
                github_auth_failed: "GitHub authentication failed.",
                github_already_linked: "This GitHub account is already connected to another user.",
            };
            setError(messages[authError] || `GitHub auth error: ${authError}`);
        }
    }, [searchParams, githubUser]);

    // Handle Phantom deep link callback (mobile)
    useEffect(() => {
        const phantomConnected = searchParams.get("phantom_connected");
        const phantomError = searchParams.get("phantom_error");

        if (phantomError) {
            setError(decodeURIComponent(phantomError));
            router.replace("/dashboard", { scroll: false });
        }

        if (phantomConnected && mobileWalletAddress && accessToken) {
            const endpoint = changingWallet ? "/api/user/change-wallet" : "/api/user/wallet";
            fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ walletAddress: mobileWalletAddress }),
            })
                .then(res => res.json())
                .then(data => {
                    if (!data.success && data.error) {
                        setError(data.error);
                        setMobileWalletAddress(null);
                        setMobileWalletSignature(null);
                    }
                    setChangingWallet(false);
                })
                .catch(() => setChangingWallet(false));

            router.replace("/dashboard", { scroll: false });
        }
    }, [searchParams, mobileWalletAddress, accessToken, changingWallet, router, setMobileWalletAddress, setMobileWalletSignature]);

    useEffect(() => {
        if (!isMobile && wallet && !connected && !connecting) {
            connect().catch(() => {});
        }
    }, [isMobile, wallet, connected, connecting, connect]);

    // Persist wallet connection when it changes (desktop only — mobile persists via handleMobileWalletSubmit)
    useEffect(() => {
        if (isMobile) return;
        if (connected && publicKey && accessToken) {
            const endpoint = changingWallet ? "/api/user/change-wallet" : "/api/user/wallet";
            fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
            })
                .then(res => res.json())
                .then(data => {
                    if (!data.success && data.error) {
                        setError(data.error);
                        disconnect();
                    }
                    setChangingWallet(false);
                })
                .catch(() => {
                    setChangingWallet(false);
                });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- changingWallet intentionally excluded: including it would re-trigger the effect after setChangingWallet(false) resolves, causing a duplicate API call
    }, [isMobile, connected, publicKey, accessToken, disconnect]);

    const handleCalculateScore = useCallback(async () => {
        if (!effectiveWalletAddress) return;
        setError(null);
        setFlowState("loading");
        setIsGithubOnlyScore(false);

        try {
            let walletSig = "";

            if (isMobile && mobileWalletSignature) {
                walletSig = `${mobileWalletSignature.nonce}:${mobileWalletSignature.signature}`;
            } else if (!isMobile && signMessage && publicKey) {
                const nonce = crypto.randomUUID();
                const message = `Kite Credit: verify ownership of ${publicKey.toBase58()} | nonce: ${nonce}`;
                const messageBytes = new TextEncoder().encode(message);
                const signatureBytes = await signMessage(messageBytes);
                const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
                walletSig = `${nonce}:${base64Signature}`;
            }

            const res = await fetch("/api/score", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: effectiveWalletAddress,
                    walletSignature: walletSig,
                    includeGithub: !!githubUser,
                }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Score calculation failed");

            setKiteScore(data.data.score);
            setAttestation(data.data.attestation);
            setFlowState("results");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setFlowState("connect");
        }
    }, [effectiveWalletAddress, isMobile, mobileWalletSignature, publicKey, signMessage, githubUser]);

    const handleCalculateDevScore = useCallback(async () => {
        if (!githubUser) return;
        setError(null);
        setFlowState("loading");
        setIsGithubOnlyScore(true);

        try {
            const res = await fetch("/api/score/github-only", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Developer score calculation failed");

            setKiteScore(data.data.score);
            setAttestation(data.data.attestation);
            setFlowState("results");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setFlowState("connect");
        }
    }, [githubUser]);

    const handleConnectGitHub = () => {
        if (accessToken) {
            document.cookie = `sb-access-token=${accessToken}; path=/; max-age=600; samesite=lax`;
        }
        window.location.href = "/api/auth/github";
    };

    const handlePhantomConnect = useCallback(() => {
        const session = createSession();
        sessionStorage.setItem("phantom_deeplink_session", serializeSession(session));

        const appUrl = window.location.origin;
        const redirectUrl = `${appUrl}/dashboard/phantom-callback`;
        const cluster = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta") as "mainnet-beta" | "testnet" | "devnet";
        const connectUrl = buildConnectUrl(session, redirectUrl, appUrl, cluster);

        window.location.href = connectUrl;
    }, []);

    const handleMobileWalletSubmit = useCallback(async () => {
        const address = mobileAddressInput.trim();
        setMobileAddressError(null);

        if (!address) {
            setMobileAddressError("Please enter a wallet address");
            return;
        }
        if (!SOLANA_ADDRESS_REGEX.test(address)) {
            setMobileAddressError("Invalid Solana wallet address");
            return;
        }

        setMobileWalletAddress(address);
        setMobileAddressInput("");

        if (accessToken) {
            try {
                const endpoint = changingWallet ? "/api/user/change-wallet" : "/api/user/wallet";
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ walletAddress: address }),
                });
                const data = await res.json();
                if (!data.success && data.error) {
                    setError(data.error);
                    setMobileWalletAddress(null);
                }
            } catch {
                setError("Failed to save wallet. Please try again.");
                setMobileWalletAddress(null);
            }
        }
        setChangingWallet(false);
    }, [mobileAddressInput, accessToken, changingWallet, setMobileWalletAddress]);

    const handleChangeWallet = async () => {
        setChangingWallet(true);
        setError(null);
        if (isMobile) {
            setMobileWalletAddress(null);
            setMobileWalletSignature(null);
            setMobileAddressInput("");
            setShowManualInput(false);
            return;
        }
        try {
            await disconnect();
            setTimeout(() => setVisible(true), 200);
        } catch {
            setError("Failed to disconnect wallet. Please try again.");
            setChangingWallet(false);
        }
    };

    const handleChangeGitHub = async () => {
        setChangingGitHub(true);
        setError(null);
        try {
            const res = await fetch("/api/user/change-github", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Failed to disconnect GitHub");

            setGithubUser(null);
            // Clear the github cookie client-side
            document.cookie = "github_token=; path=/; max-age=0";
            // Redirect to GitHub OAuth
            handleConnectGitHub();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to change GitHub account");
            setChangingGitHub(false);
        }
    };

    const handleLinkEthWallet = async () => {
        setEthLinking(true);
        setEthError(null);
        try {
            const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
            if (!ethereum) {
                setEthError("No Ethereum wallet detected. Install MetaMask or a compatible wallet.");
                return;
            }

            const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
            const account = accounts[0];
            if (!account) {
                setEthError("No account returned from wallet.");
                return;
            }

            const nonceRes = await fetch("/api/user/link-wallet");
            const nonceData = await nonceRes.json();
            if (!nonceData.success) throw new Error("Failed to get nonce");
            const { nonce } = nonceData.data as { nonce: string };

            const signature = await ethereum.request({
                method: "personal_sign",
                params: [nonce, account],
            }) as string;

            const linkRes = await fetch("/api/user/link-wallet", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ address: account, signature, nonce }),
            });
            const linkData = await linkRes.json();
            if (!linkData.success) throw new Error(linkData.error || "Failed to link wallet");

            setEthAddress((linkData.data as { address: string }).address);
        } catch (err) {
            setEthError(err instanceof Error ? err.message : "Failed to link Ethereum wallet");
        } finally {
            setEthLinking(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.push("/auth");
    };

    const canCalculateFullScore = isWalletConnected;
    const canCalculateDevScore = !!githubUser && !isWalletConnected;
    const canCalculateAnyScore = canCalculateFullScore || canCalculateDevScore;

    if (authLoading || !user || restoringData) {
        return (
            <div className="relative min-h-screen overflow-hidden font-sans">
                <div className="fixed inset-0 z-0">
                    <Image
                        src="/city_background.png"
                        alt=""
                        fill
                        className="object-cover object-center"
                        priority
                        quality={90}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90" />
                </div>
                <div className="relative z-10 flex items-center justify-center min-h-screen">
                    <motion.div
                        className="w-12 h-12 bg-gradient-to-br from-orange-500 to-sky-500 rotate-45"
                        animate={{ rotate: [45, 135, 225, 315, 405], scale: [1, 1.1, 1, 0.9, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden font-sans">
            {/* City Background */}
            <div className="fixed inset-0 z-0">
                <Image
                    src="/city_background.png"
                    alt=""
                    fill
                    className="object-cover object-center"
                    priority
                    quality={90}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {/* Header */}
                <header className="px-4 sm:px-6 md:px-12 pt-6 sm:pt-8 pb-4">
                    <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
                        <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-sky-400 rotate-45 shadow-[0_0_15px_rgba(56,189,248,0.6)]" />
                            <h1 className="text-base sm:text-xl font-bold text-white tracking-wider uppercase">
                                Kite Credit
                            </h1>
                        </Link>
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-xs text-white/60 font-mono">
                                    {user.name || user.email}
                                </span>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="text-xs text-white/40 hover:text-white/70 transition-colors tracking-widest uppercase border border-white/10 px-2.5 py-1.5 sm:px-3 rounded-lg hover:border-white/20"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-8">
                    <AnimatePresence mode="wait">
                        {flowState === "connect" && (
                            <motion.div
                                key="connect"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -30 }}
                                transition={{ duration: 0.6 }}
                            >
                                {/* Hero Section */}
                                <div className="text-center mb-8 sm:mb-16">
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="text-xs md:text-sm text-sky-300 font-mono tracking-[0.3em] uppercase mb-4"
                                    >
                                        Decentralized Credit Protocol
                                    </motion.p>
                                    <motion.h2
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3, duration: 0.6 }}
                                        className="text-4xl md:text-7xl font-black text-white tracking-tighter mb-6 drop-shadow-2xl"
                                    >
                                        YOUR KITE SCORE
                                    </motion.h2>
                                    <div className="h-1 w-24 bg-gradient-to-r from-orange-500 to-sky-400 mx-auto rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)]" />
                                </div>

                                {/* Source Connection Cards */}
                                <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12">
                                    {/* Solana Wallet Card */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 }}
                                        className="relative group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-blue-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-60" />
                                        <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-xl p-6 border border-sky-500/20 hover:border-sky-400/40 transition-all shadow-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-3 h-3 bg-sky-400 rotate-45" />
                                                <h3 className="text-lg font-bold text-white tracking-wide uppercase">
                                                    On-Chain
                                                </h3>
                                            </div>
                                            <p className="text-sm text-white/60 mb-6 leading-relaxed">
                                                Wallet age, DeFi history, staking activity, and transaction patterns.
                                            </p>
                                            {isWalletConnected ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-400/30 rounded-lg px-4 py-3">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                        <span className="text-sm text-sky-200 font-mono truncate">
                                                            {effectiveWalletAddress
                                                                ? `${effectiveWalletAddress.slice(0, 8)}...${effectiveWalletAddress.slice(-6)}`
                                                                : ""}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={handleChangeWallet}
                                                        disabled={changingWallet}
                                                        className="w-full py-2 text-[11px] text-sky-300/60 hover:text-sky-200 font-mono tracking-wider uppercase border border-sky-500/10 hover:border-sky-400/30 rounded-lg transition-all disabled:opacity-50"
                                                    >
                                                        {changingWallet ? "Switching..." : "Connect Different Wallet"}
                                                    </button>
                                                </div>
                                            ) : isMobile ? (
                                                <div className="space-y-3">
                                                    <button
                                                        onClick={handlePhantomConnect}
                                                        className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold tracking-wider uppercase text-sm rounded-lg active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <rect width="128" height="128" rx="26" fill="url(#phantom-grad)"/>
                                                            <path d="M110.584 64.914H99.142C99.142 41.066 79.8 21.724 55.952 21.724C32.516 21.724 13.44 40.378 12.82 63.658C12.186 87.49 33.038 108.276 56.87 108.276H60.064C81.054 108.276 110.584 87.49 110.584 64.914Z" fill="url(#phantom-grad2)"/>
                                                            <path d="M86.354 64.914C86.354 68.108 83.71 70.752 80.516 70.752C77.322 70.752 74.678 68.108 74.678 64.914C74.678 61.72 77.322 59.076 80.516 59.076C83.71 59.076 86.354 61.72 86.354 64.914Z" fill="white"/>
                                                            <path d="M67.354 64.914C67.354 68.108 64.71 70.752 61.516 70.752C58.322 70.752 55.678 68.108 55.678 64.914C55.678 61.72 58.322 59.076 61.516 59.076C64.71 59.076 67.354 61.72 67.354 64.914Z" fill="white"/>
                                                            <defs>
                                                                <linearGradient id="phantom-grad" x1="64" y1="0" x2="64" y2="128" gradientUnits="userSpaceOnUse"><stop stopColor="#534BB1"/><stop offset="1" stopColor="#551BF9"/></linearGradient>
                                                                <linearGradient id="phantom-grad2" x1="61.702" y1="21.724" x2="61.702" y2="108.276" gradientUnits="userSpaceOnUse"><stop stopColor="#534BB1"/><stop offset="1" stopColor="#551BF9"/></linearGradient>
                                                            </defs>
                                                        </svg>
                                                        Connect with Phantom
                                                    </button>

                                                    {!showManualInput ? (
                                                        <button
                                                            onClick={() => setShowManualInput(true)}
                                                            className="w-full py-2 text-[11px] text-sky-300/50 hover:text-sky-200 font-mono tracking-wider uppercase border border-sky-500/10 hover:border-sky-400/20 rounded-lg transition-all"
                                                        >
                                                            Or enter address manually
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <input
                                                                type="text"
                                                                value={mobileAddressInput}
                                                                onChange={(e) => {
                                                                    setMobileAddressInput(e.target.value);
                                                                    setMobileAddressError(null);
                                                                }}
                                                                placeholder="Paste your Solana address"
                                                                className="w-full px-4 py-3 bg-white/5 border border-sky-500/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30 transition-all font-mono"
                                                                autoComplete="off"
                                                                autoCorrect="off"
                                                                spellCheck={false}
                                                            />
                                                            {mobileAddressError && (
                                                                <p className="text-xs text-red-400">{mobileAddressError}</p>
                                                            )}
                                                            <button
                                                                onClick={handleMobileWalletSubmit}
                                                                disabled={!mobileAddressInput.trim()}
                                                                className="w-full py-3 bg-white/10 border border-sky-500/20 text-white font-bold tracking-wider uppercase text-sm rounded-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                Submit Address
                                                            </button>
                                                            <p className="text-[10px] text-amber-300/50 text-center leading-relaxed">
                                                                Manual addresses cannot be verified for ownership. Use Phantom for a verified connection.
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    className="w-full py-3.5 sm:py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold tracking-wider uppercase text-sm rounded-lg hover:from-sky-400 hover:to-blue-500 active:scale-[0.98] transition-all shadow-lg"
                                                    onClick={() => setVisible(true)}
                                                >
                                                    Connect Wallet
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Financial Verification Card (Coming Soon) */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                        className="relative group overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-600/10 rounded-xl blur-xl opacity-40" />
                                        <div className="relative bg-slate-900/40 backdrop-blur-lg rounded-xl p-6 border border-white/5 shadow-2xl h-full flex flex-col grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                                            <div className="absolute top-3 right-3 bg-white/10 text-white/60 text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded border border-white/10">
                                                Coming Soon
                                            </div>

                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-3 h-3 bg-orange-400 rotate-45 opacity-50" />
                                                <h3 className="text-lg font-bold text-white/50 tracking-wide uppercase">
                                                    Financial
                                                </h3>
                                            </div>
                                            <p className="text-sm text-white/30 mb-6 leading-relaxed">
                                                ZK-verified bank balance, income consistency, and cash flow health.
                                            </p>

                                            <div className="mt-auto w-full py-3 bg-white/5 border border-white/5 text-white/20 font-bold tracking-wider uppercase text-sm rounded-lg text-center cursor-not-allowed">
                                                Connect Bank
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* GitHub Developer Card */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.6 }}
                                        className="relative group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-violet-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-60" />
                                        <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-xl p-6 border border-indigo-500/20 hover:border-indigo-400/40 transition-all shadow-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-3 h-3 bg-indigo-400 rotate-45" />
                                                <h3 className="text-lg font-bold text-white tracking-wide uppercase">
                                                    GitHub
                                                </h3>
                                            </div>
                                            <p className="text-sm text-white/60 mb-6 leading-relaxed">
                                                Developer reputation, code quality, commit history, and community trust.
                                            </p>
                                            {githubUser ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-400/30 rounded-lg px-4 py-3">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                        <span className="text-sm text-indigo-200 font-mono">@{githubUser}</span>
                                                    </div>
                                                    <button
                                                        onClick={handleChangeGitHub}
                                                        disabled={changingGitHub}
                                                        className="w-full py-2 text-[11px] text-indigo-300/60 hover:text-indigo-200 font-mono tracking-wider uppercase border border-indigo-500/10 hover:border-indigo-400/30 rounded-lg transition-all disabled:opacity-50"
                                                    >
                                                        {changingGitHub ? "Switching..." : "Connect Different GitHub"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleConnectGitHub}
                                                    className="w-full py-3.5 sm:py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold tracking-wider uppercase text-sm rounded-lg hover:from-indigo-400 hover:to-violet-500 active:scale-[0.98] transition-all shadow-lg"
                                                >
                                                    Connect GitHub
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Ethereum Wallet Card — shown only when window.ethereum is available */}
                                {typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7 }}
                                        className="relative group mt-4"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-600/10 rounded-xl blur-xl opacity-50" />
                                        <div className="relative bg-slate-900/80 backdrop-blur-lg rounded-xl p-5 border border-emerald-500/20 hover:border-emerald-400/40 transition-all shadow-xl">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-emerald-400 rotate-45" />
                                                    <h3 className="text-base font-bold text-white tracking-wide uppercase">
                                                        Ethereum Wallet
                                                    </h3>
                                                    <span className="text-[10px] text-emerald-400/60 font-mono tracking-widest uppercase border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                                        Optional
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-white/50 mb-4 leading-relaxed">
                                                Link your Ethereum wallet to include Aave, Compound, Uniswap, and Lido activity in your score.
                                            </p>
                                            {ethAddress ? (
                                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-4 py-3">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-sm text-emerald-200 font-mono truncate">
                                                        {ethAddress.slice(0, 8)}...{ethAddress.slice(-6)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={handleLinkEthWallet}
                                                        disabled={ethLinking}
                                                        className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold tracking-wider uppercase text-sm rounded-lg hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {ethLinking ? "Linking..." : "Link ETH Wallet"}
                                                    </button>
                                                    {ethError && (
                                                        <p className="mt-2 text-xs text-red-400">{ethError}</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Calculate Buttons */}
                                {canCalculateAnyScore && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.8 }}
                                        className="text-center space-y-4"
                                    >
                                        {canCalculateFullScore && (
                                            <>
                                                <button
                                                    onClick={handleCalculateScore}
                                                    className="relative group px-12 py-5 text-white font-bold tracking-[0.2em] uppercase overflow-hidden rounded-sm"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-sky-500 to-indigo-500 transition-opacity group-hover:opacity-90" />
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-orange-400 via-sky-400 to-indigo-400" />
                                                    <div className="absolute inset-0 blur-xl bg-gradient-to-r from-orange-500/40 via-sky-500/40 to-indigo-500/40 group-hover:blur-2xl transition-all" />
                                                    <span className="relative z-10 text-sm md:text-base">Calculate Kite Score</span>
                                                </button>

                                                <p className="mt-6 text-xs text-white/30 font-mono tracking-wider">
                                                    {isMobile && mobileWalletSignature
                                                        ? "Wallet verified via Phantom. Ready to calculate."
                                                        : isMobile
                                                        ? "Score is calculated from public on-chain activity"
                                                        : "Your wallet will sign a verification message to prove ownership"}
                                                </p>
                                            </>
                                        )}

                                        {canCalculateDevScore && (
                                            <>
                                                <button
                                                    onClick={handleCalculateDevScore}
                                                    className="relative group px-12 py-5 text-white font-bold tracking-[0.2em] uppercase overflow-hidden rounded-sm"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 transition-opacity group-hover:opacity-90" />
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400" />
                                                    <div className="absolute inset-0 blur-xl bg-gradient-to-r from-indigo-500/40 via-violet-500/40 to-purple-500/40 group-hover:blur-2xl transition-all" />
                                                    <span className="relative z-10 text-sm md:text-base">Calculate Developer Score</span>
                                                </button>

                                                {/* Developer-only warning */}
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 1 }}
                                                    className="max-w-lg mx-auto mt-4 bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-4"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-2 h-2 bg-indigo-400 rotate-45 mt-1.5 flex-shrink-0" />
                                                        <div className="text-left">
                                                            <p className="text-xs font-bold text-indigo-300/80 tracking-wider uppercase mb-1">
                                                                Developer Score Only
                                                            </p>
                                                            <p className="text-xs text-white/50 leading-relaxed">
                                                                This score evaluates technical reputation based on your GitHub activity.
                                                                It is designed for developers and does not provide financial or credit insights.
                                                                Connect a wallet for a comprehensive credit score.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </>
                                        )}
                                    </motion.div>
                                )}

                                {/* Error message */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="mt-6 max-w-md mx-auto bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center"
                                    >
                                        <p className="text-sm text-red-300">{error}</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {flowState === "loading" && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center min-h-[60vh]"
                            >
                                <motion.div
                                    className={`w-20 h-20 bg-gradient-to-br ${isGithubOnlyScore ? "from-indigo-500 to-violet-500" : "from-orange-500 to-sky-500"} rotate-45 mb-12`}
                                    animate={{
                                        rotate: [45, 135, 225, 315, 405],
                                        scale: [1, 1.1, 1, 0.9, 1],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />
                                <p className="text-lg text-white font-light tracking-widest uppercase">
                                    {isGithubOnlyScore ? "Analyzing developer profile..." : "Calculating your score..."}
                                </p>
                                <div className="flex gap-2 mt-6">
                                    {(isGithubOnlyScore
                                        ? ["GitHub", "Code Quality", "AI Analysis"]
                                        : ["On-Chain", "Financial", "AI Analysis"]
                                    ).map((step, i) => (
                                        <motion.span
                                            key={step}
                                            initial={{ opacity: 0.3 }}
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{
                                                duration: 1.5,
                                                delay: i * 0.4,
                                                repeat: Infinity,
                                            }}
                                            className={`text-xs font-mono tracking-wider ${isGithubOnlyScore ? "text-indigo-300/60" : "text-sky-300/60"}`}
                                        >
                                            {step}
                                        </motion.span>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {flowState === "results" && kiteScore && (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8 }}
                                className="space-y-10"
                            >
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-200">
                                        {isGithubOnlyScore ? "Your Developer Profile" : "Your Credit Profile"}
                                    </h2>
                                    <Link href="/how-it-works" className="text-xs text-white/50 hover:text-white/80 transition-colors uppercase tracking-widest border border-white/10 px-4 py-2 rounded-full">
                                        How It Works
                                    </Link>
                                </div>

                                {/* GitHub-only score notice */}
                                {isGithubOnlyScore && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-2 h-2 bg-indigo-400 rotate-45 mt-1.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold text-indigo-300/80 tracking-wider uppercase mb-1">
                                                    Developer Score
                                                </p>
                                                <p className="text-xs text-white/50 leading-relaxed">
                                                    This score is based solely on your GitHub activity and reflects technical reputation.
                                                    It does not include financial or on-chain credit data. Connect a wallet to get a comprehensive Kite Score.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div className="grid lg:grid-cols-12 gap-8">
                                    {/* Left Column: Score + Attestation + Share */}
                                    <div className="lg:col-span-5 space-y-6">
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-purple-500/5" />
                                            <div className="relative z-10">
                                                <ScoreDisplay score={kiteScore} githubOnly={isGithubOnlyScore} onModeChange={setViewMode} />

                                                {/* Score freshness row */}
                                                {kiteScore.timestamp && (() => {
                                                    const { label, status, daysUntilExpiry } = getScoreAge(kiteScore.timestamp);
                                                    const dotColor = status === "fresh" ? "bg-emerald-400" : status === "aging" ? "bg-amber-400" : "bg-orange-400";
                                                    const textColor = status === "fresh" ? "text-emerald-400" : status === "aging" ? "text-amber-400" : "text-orange-400";
                                                    return (
                                                        <div className="mt-5 flex items-center justify-between px-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                                                <span className={`text-xs font-mono ${textColor}`}>{label}</span>
                                                                <span className="text-xs text-white/20 font-mono">
                                                                    · expires in {daysUntilExpiry}d
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={handleCalculateScore}
                                                                className="text-[10px] font-mono text-sky-400/50 hover:text-sky-400 tracking-wider uppercase transition-colors"
                                                            >
                                                                Refresh →
                                                            </button>
                                                        </div>
                                                    );
                                                })()}

                                                {attestation && (
                                                    <div className="mt-8">
                                                        <AttestationCard attestation={attestation} />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>

                                        <ShareScoreCard
                                            score={kiteScore}
                                            attestation={attestation}
                                            activeMode={isGithubOnlyScore ? "dev" : viewMode}
                                        />
                                    </div>

                                    {/* Right Column: Radar + AI + Breakdown */}
                                    <div className="lg:col-span-7 space-y-6">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.2 }}
                                            className="grid md:grid-cols-2 gap-6"
                                        >
                                            {!isGithubOnlyScore && viewMode === "crypto" && (
                                                <div className="bg-slate-900/40 backdrop-blur-lg rounded-2xl p-6 border border-white/5 flex items-center justify-center min-h-[300px]">
                                                    {kiteScore.breakdown.fiveFactor && (
                                                        <ScoreRadarChart breakdown={kiteScore.breakdown.fiveFactor} />
                                                    )}
                                                </div>
                                            )}

                                            <div className={`bg-slate-900/40 backdrop-blur-lg rounded-2xl p-6 border border-white/5 flex flex-col justify-center ${isGithubOnlyScore || viewMode === "dev" ? "md:col-span-2" : ""}`}>
                                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">AI Analysis</h4>
                                                <p className="text-sm text-white/80 leading-relaxed italic border-l-2 border-indigo-500/30 pl-4 py-2">
                                                    &quot;{kiteScore.explanation}&quot;
                                                </p>
                                            </div>
                                        </motion.div>

                                        <ScoreBreakdownPanel
                                            breakdown={kiteScore.breakdown}
                                            viewMode={isGithubOnlyScore ? "dev" : viewMode}
                                        />
                                    </div>
                                </div>

                                {/* Recalculate */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                    className="flex justify-center pt-4 pb-12"
                                >
                                    <button
                                        onClick={() => {
                                            setFlowState("connect");
                                            setIsGithubOnlyScore(false);
                                        }}
                                        className="px-8 py-3 bg-white text-slate-900 font-bold tracking-[0.2em] uppercase text-sm rounded-sm hover:bg-sky-50 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                                    >
                                        Recalculate Score
                                    </button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={null}>
            <DashboardContent />
        </Suspense>
    );
}
