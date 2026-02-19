"use client";

import { useMemo, useCallback, type ReactNode } from "react";
import {
    ConnectionProvider,
    WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    WalletNotReadyError,
    type Adapter,
    type WalletError,
} from "@solana/wallet-adapter-base";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
    children: ReactNode;
}

export default function WalletProvider({ children }: Props) {
    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta") as Cluster;

    const endpoint = useMemo(() => {
        if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
            return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
        }
        return clusterApiUrl(network);
    }, [network]);

    // Explicit adapters ensure wallets appear on mobile (where Wallet Standard
    // browser-extension detection doesn't work). Each adapter handles deep-linking
    // to its respective mobile app automatically.
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new CoinbaseWalletAdapter(),
        ],
        [],
    );

    const onError = useCallback((error: WalletError, adapter?: Adapter) => {
        if (error instanceof WalletNotReadyError && adapter && typeof window !== "undefined") {
            window.open(adapter.url, "_blank");
            return;
        }
        console.error("[WalletProvider]", error.name, error.message);
    }, []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider
                wallets={wallets}
                autoConnect={true}
                onError={onError}
            >
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
}
