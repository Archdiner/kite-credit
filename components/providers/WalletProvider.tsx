"use client";

import {
    useMemo,
    useCallback,
    useState,
    createContext,
    useContext,
    type ReactNode,
} from "react";
import {
    ConnectionProvider,
    WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    type WalletError,
} from "@solana/wallet-adapter-base";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

function getIsMobile(): boolean {
    if (typeof window === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
        navigator.userAgent,
    );
}

export interface MobileWalletSignature {
    signature: string;
    nonce: string;
}

interface MobileWalletContextValue {
    isMobile: boolean;
    mobileWalletAddress: string | null;
    setMobileWalletAddress: (address: string | null) => void;
    mobileWalletSignature: MobileWalletSignature | null;
    setMobileWalletSignature: (sig: MobileWalletSignature | null) => void;
}

const MobileWalletContext = createContext<MobileWalletContextValue>({
    isMobile: false,
    mobileWalletAddress: null,
    setMobileWalletAddress: () => {},
    mobileWalletSignature: null,
    setMobileWalletSignature: () => {},
});

export function useMobileWallet() {
    return useContext(MobileWalletContext);
}

interface Props {
    children: ReactNode;
}

export default function WalletProvider({ children }: Props) {
    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta") as Cluster;
    const [isMobile] = useState(() => getIsMobile());
    const [mobileWalletAddress, setMobileWalletAddress] = useState<string | null>(null);
    const [mobileWalletSignature, setMobileWalletSignature] = useState<MobileWalletSignature | null>(null);

    const endpoint = useMemo(() => {
        if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
            return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
        }
        return clusterApiUrl(network);
    }, [network]);

    const wallets = useMemo(
        () =>
            isMobile
                ? []
                : [
                      new PhantomWalletAdapter(),
                      new SolflareWalletAdapter(),
                      new CoinbaseWalletAdapter(),
                  ],
        [isMobile],
    );

    const onError = useCallback((error: WalletError) => {
        console.error("[WalletProvider]", error.name, error.message);
    }, []);

    return (
        <MobileWalletContext.Provider
            value={{
                isMobile,
                mobileWalletAddress,
                setMobileWalletAddress,
                mobileWalletSignature,
                setMobileWalletSignature,
            }}
        >
            <ConnectionProvider endpoint={endpoint}>
                <SolanaWalletProvider
                    wallets={wallets}
                    autoConnect={!isMobile}
                    onError={onError}
                >
                    <WalletModalProvider>{children}</WalletModalProvider>
                </SolanaWalletProvider>
            </ConnectionProvider>
        </MobileWalletContext.Provider>
    );
}
