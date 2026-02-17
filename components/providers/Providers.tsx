"use client";

import { type ReactNode } from "react";
import WalletProvider from "@/components/providers/WalletProvider";
import AuthProvider from "@/components/providers/AuthProvider";

interface Props {
    children: ReactNode;
}

export default function Providers({ children }: Props) {
    return (
        <AuthProvider>
            <WalletProvider>
                {children}
            </WalletProvider>
        </AuthProvider>
    );
}
