"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMobileWallet } from "@/components/providers/WalletProvider";
import {
    deserializeSession,
    handleConnectResponse,
    handleSignMessageResponse,
    serializeSession,
    buildSignMessageUrl,
} from "@/lib/phantom-deeplink";

const STORAGE_KEY = "phantom_deeplink_session";
const NONCE_KEY = "phantom_deeplink_nonce";

function PhantomCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { setMobileWalletAddress, setMobileWalletSignature } = useMobileWallet();

    useEffect(() => {
        const step = searchParams.get("step");
        const errorCode = searchParams.get("errorCode");

        if (errorCode) {
            const msg = searchParams.get("errorMessage") || "Connection rejected";
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(NONCE_KEY);
            router.replace(`/dashboard?phantom_error=${encodeURIComponent(msg)}`);
            return;
        }

        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            router.replace("/dashboard?phantom_error=Session+expired.+Please+try+again.");
            return;
        }

        try {
            if (step === "sign") {
                const session = deserializeSession(raw);
                const { signature } = handleSignMessageResponse(session, searchParams);
                const nonce = sessionStorage.getItem(NONCE_KEY) || "";

                setMobileWalletAddress(session.publicKey);
                setMobileWalletSignature({ signature, nonce });

                sessionStorage.removeItem(STORAGE_KEY);
                sessionStorage.removeItem(NONCE_KEY);
                router.replace("/dashboard?phantom_connected=true");
            } else {
                const partialSession = deserializeSession(raw);
                const connectedSession = handleConnectResponse(partialSession, searchParams);
                sessionStorage.setItem(STORAGE_KEY, serializeSession(connectedSession));

                const walletAddress = connectedSession.publicKey!;
                const nonce = crypto.randomUUID();
                sessionStorage.setItem(NONCE_KEY, nonce);

                const message = `Kite Credit: verify ownership of ${walletAddress} | nonce: ${nonce}`;
                const appUrl = window.location.origin;
                const signRedirect = `${appUrl}/dashboard/phantom-callback?step=sign`;
                const signUrl = buildSignMessageUrl(connectedSession, message, signRedirect);

                window.location.href = signUrl;
            }
        } catch (err) {
            console.error("[phantom-callback]", err);
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(NONCE_KEY);
            const msg = err instanceof Error ? err.message : "Wallet connection failed";
            router.replace(`/dashboard?phantom_error=${encodeURIComponent(msg)}`);
        }
    }, [searchParams, router, setMobileWalletAddress, setMobileWalletSignature]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />
                <p className="text-sm text-white/50 tracking-wider uppercase">
                    Connecting wallet...
                </p>
            </div>
        </div>
    );
}

export default function PhantomCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-900">
                    <div className="w-10 h-10 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />
                </div>
            }
        >
            <PhantomCallbackContent />
        </Suspense>
    );
}
