"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkButtonProps {
    onSuccess: (publicToken: string) => void;
    userId?: string;
    className?: string;
    children?: React.ReactNode;
}

export default function PlaidLinkButton({ onSuccess, userId, className, children }: PlaidLinkButtonProps) {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasAttempted, setHasAttempted] = useState(false);

    // Create Link Token — re-run when userId becomes available
    useEffect(() => {
        if (hasAttempted && token) return; // Don't re-fetch if we already have a token

        const createLinkToken = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch("/api/plaid/create-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clientUserId: userId || "user-" + crypto.randomUUID(),
                    }),
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `Server error: ${response.status}`);
                }

                // successResponse wraps in { success, data: { link_token } }
                const linkToken = data.data?.link_token || data.link_token;
                if (linkToken) {
                    setToken(linkToken);
                } else {
                    console.error("[PlaidLinkButton] Response data:", JSON.stringify(data));
                    throw new Error("No link token in server response");
                }
            } catch (err) {
                console.error("[PlaidLinkButton] Failed to create link token:", err);
                setError(err instanceof Error ? err.message : "Connection failed");
            } finally {
                setIsLoading(false);
                setHasAttempted(true);
            }
        };

        createLinkToken();
    }, [userId, hasAttempted, token]);

    // Handle Plaid success
    const onSuccessCallback = useCallback(
        (publicToken: string) => {
            onSuccess(publicToken);
        },
        [onSuccess]
    );

    // Initialize Plaid Link
    const { open, ready } = usePlaidLink({
        token,
        onSuccess: onSuccessCallback,
        onExit: (err) => {
            if (err) {
                console.error("[PlaidLinkButton] Plaid Link exited with error:", err);
            }
        },
    });

    const handleClick = () => {
        if (error) {
            // Retry: reset state and re-fetch token
            setError(null);
            setHasAttempted(false);
            setToken(null);
            return;
        }
        open();
    };

    const buttonLabel = error
        ? "Retry Connection"
        : isLoading
            ? "Preparing..."
            : !ready
                ? "Loading..."
                : children || "Connect Bank Account";

    return (
        <div className="flex flex-col gap-2 w-full">
            <button
                onClick={handleClick}
                disabled={isLoading || (!ready && !error)}
                className={
                    className ||
                    "px-4 py-2 bg-slate-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                }
            >
                {buttonLabel}
            </button>
            {error && (
                <p className="text-xs text-red-400 text-center">
                    {error}
                </p>
            )}
        </div>
    );
}
