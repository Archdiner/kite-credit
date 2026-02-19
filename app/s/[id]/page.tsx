import type { Metadata } from "next";
import { getShareData } from "@/lib/share";
import SharePageClient from "@/app/share/SharePageClient";

const FALLBACK_META: Metadata = {
    title: "Kite Credit Score",
    description: "View this Kite Credit score and get your own.",
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const data = await getShareData(id);
    if (!data) return FALLBACK_META;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kite.credit";
    const title = `Kite Score: ${data.cryptoScore}/1000 — ${data.cryptoTier}`;
    const description = data.devScore
        ? `Crypto: ${data.cryptoScore}/1000 (${data.cryptoTier}) | Developer: ${data.devScore}/1000 (${data.devTier}) — Verified on-chain credit score`
        : `${data.cryptoScore}/1000 (${data.cryptoTier}) — Verified on-chain credit score`;

    const ogImageUrl = `${appUrl}/s/${id}/og`;

    return {
        title,
        description,
        openGraph: {
            type: "website",
            siteName: "Kite Credit",
            title,
            description,
            url: `${appUrl}/s/${id}`,
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

export default async function ShortSharePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const data = await getShareData(id);
    return <SharePageClient data={data} />;
}
