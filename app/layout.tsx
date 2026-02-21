import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Providers from "@/components/providers/Providers";
import ErrorBoundary from "@/components/ErrorBoundary";

const outfit = Outfit({
    variable: "--font-outfit",
    subsets: ["latin"],
});

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kitecredit.xyz";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: "#0f172a",
};

export const metadata: Metadata = {
    title: {
        default: "Kite Credit | Portable Cross-Border Credit Score",
        template: "%s | Kite Credit",
    },
    description:
        "Build your portable credit score from on-chain activity, financial data, and professional reputation. Privacy-first, globally accessible.",
    keywords: [
        "credit score",
        "DeFi credit",
        "crypto credit",
        "cross-border credit",
        "Solana",
        "on-chain reputation",
        "ZK attestation",
    ],
    authors: [{ name: "Kite Credit" }],
    openGraph: {
        type: "website",
        siteName: "Kite Credit",
        title: "Kite Credit — Lift the Floor",
        description:
            "Your portable credit score built from on-chain activity, financial verification, and professional reputation.",
        url: APP_URL,
        locale: "en_US",
    },
    twitter: {
        card: "summary_large_image",
        title: "Kite Credit — Portable Cross-Border Credit",
        description:
            "Build your credit score from crypto, bank data, and professional reputation. Privacy-first.",
    },
    robots: {
        index: true,
        follow: true,
    },
    metadataBase: new URL(APP_URL),
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${outfit.variable} ${inter.variable} antialiased`}
                suppressHydrationWarning
            >
                <Providers>
                    <ErrorBoundary>
                        <SmoothScroll>{children}</SmoothScroll>
                    </ErrorBoundary>
                </Providers>
            </body>
        </html>
    );
}
