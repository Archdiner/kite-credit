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

    // 1. Create Link Token on mount
    useEffect(() => {
        const createLinkToken = async () => {
            const response = await fetch("/api/plaid/create-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientUserId: "user-" + Math.random() }), // temporary user ID
            });
            const data = await response.json();
            setToken(data.link_token);
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
        <button
            onClick={() => open()}
            disabled={!ready}
            className={className || "px-4 py-2 bg-slate-800 text-white rounded disabled:opacity-50"}
        >
            {children || "Connect Bank Account"}
        </button>
    );
}
