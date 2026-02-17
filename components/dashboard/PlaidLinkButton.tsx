"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkButtonProps {
    onSuccess: (publicToken: string) => void;
    className?: string; // allow custom styling
    children?: React.ReactNode;
}

export default function PlaidLinkButton({ onSuccess, className, children }: PlaidLinkButtonProps) {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Create Link Token on mount
    useEffect(() => {
        const createLinkToken = async () => {
            try {
                const response = await fetch("/api/plaid/create-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientUserId: "user-" + crypto.randomUUID() }),
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to create link token");
                }

                // successResponse wraps in { success, data: { link_token } }
                const linkToken = data.data?.link_token || data.link_token;
                if (linkToken) {
                    setToken(linkToken);
                } else {
                    throw new Error("No link token received");
                }
            } catch (err) {
                console.error("[PlaidLinkButton] Failed to create link token:", err);
                setError(err instanceof Error ? err.message : "Connection failed");
            } finally {
                setIsLoading(false);
            }
        };
        createLinkToken();
    }, []);

    // 2. Handle Success (exchange token)
    const onSuccessCallback = useCallback(
        (publicToken: string) => {
            onSuccess(publicToken);
        },
        [onSuccess]
    );

    // 3. Initialize Link
    const { open, ready } = usePlaidLink({
        token,
        onSuccess: onSuccessCallback,
    });

    return (
        <div className="flex flex-col gap-2 w-full">
            <button
                onClick={() => open()}
                disabled={!ready || !!error}
                className={className || "px-4 py-2 bg-slate-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"}
            >
                {error ? "Unavailable" : isLoading ? "Loading..." : children || "Connect Bank Account"}
            </button>
            {error && (
                <p className="text-xs text-red-400 text-center">
                    {error}
                </p>
            )}
        </div>
    );
}
