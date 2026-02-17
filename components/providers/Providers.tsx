"use client";

import { type ReactNode } from "react";
import WalletProvider from "@/components/providers/WalletProvider";

interface Props {
    children: ReactNode;
}

export default function Providers({ children }: Props) {
    return (
        <WalletProvider>
            {children}
        </WalletProvider>
    );
}
