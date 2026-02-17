"use client";

import { useMemo, type ReactNode } from "react";
import {
    ConnectionProvider,
    WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

// Default styles for the wallet adapter modal
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
    children: ReactNode;
}

export default function WalletProvider({ children }: Props) {
    // Determine the Solana network. Default to mainnet-beta if not specified.
    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta") as Cluster;

    const endpoint = useMemo(() => {
        if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
            return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
        }
        console.warn("Using public Solana RPC endpoint. Rate limits may apply.");
        return clusterApiUrl(network);
    }, [network]);

    const wallets = useMemo(
        () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
}
