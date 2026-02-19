import type { Metadata } from "next";
import type { ShareData } from "@/types";
import { getTier } from "@/lib/scoring";
import SharePageClient from "./SharePageClient";

function decodeShareData(encoded: string): ShareData | null {
    try {
        const json = Buffer.from(encoded, "base64").toString("utf-8");
        const parsed = JSON.parse(json);
        return {
            ...parsed,
            cryptoTier: getTier(parsed.cryptoScore),
            devTier: parsed.devScore != null ? getTier(parsed.devScore) : null,
        };
    } catch {
        return null;
    }
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ d?: string }>;
}): Promise<Metadata> {
    const params = await searchParams;
    const encoded = params.d;
    if (!encoded) {
        return {
            title: "Kite Credit Score",
            description: "View this Kite Credit score and get your own.",
        };
    }

    const data = decodeShareData(encoded);
    if (!data) {
        return {
            title: "Kite Credit Score",
            description: "View this Kite Credit score and get your own.",
        };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kite.credit";
    const title = `Kite Score: ${data.cryptoScore}/1000 — ${data.cryptoTier}`;
    const description = data.devScore
        ? `Crypto: ${data.cryptoScore}/1000 (${data.cryptoTier}) | Developer: ${data.devScore}/1000 (${data.devTier}) — Verified on-chain credit score`
        : `${data.cryptoScore}/1000 (${data.cryptoTier}) — Verified on-chain credit score`;

    const ogImageUrl = `${appUrl}/share/og?d=${encoded}`;

    return {
        title,
        description,
        openGraph: {
            type: "website",
            siteName: "Kite Credit",
            title,
            description,
            url: `${appUrl}/share?d=${encoded}`,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: `Kite Credit Score: ${data.cryptoScore}/1000`,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [ogImageUrl],
        },
    };
}

export default async function SharePage({
    searchParams,
}: {
    searchParams: Promise<{ d?: string }>;
}) {
    const params = await searchParams;
    const data = params.d ? decodeShareData(params.d) : null;
    return <SharePageClient data={data} />;
}
