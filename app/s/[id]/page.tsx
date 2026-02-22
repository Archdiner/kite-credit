import type { Metadata } from "next";
import { createHmac } from "node:crypto";
import { getShareData } from "@/lib/share";
import SharePageClient from "@/app/share/SharePageClient";
import type { ShareData } from "@/types";

const FALLBACK_META: Metadata = {
    title: "Kite Credit Score",
    description: "View this Kite Credit score and get your own.",
};

function verifyProof(data: ShareData): boolean {
    try {
        const secret = process.env.ATTESTATION_SECRET || "dev-attestation-secret-change-me";
        const proofData = JSON.stringify({
            total: data.cryptoScore,
            tier: data.cryptoTier,
            sources: data.verifiedAttrs,
            timestamp: data.attestationDate,
        });
        const hmac = createHmac("sha256", secret);
        hmac.update(proofData);
        const expected = "0x" + hmac.digest("hex");
        return data.proof === expected;
    } catch {
        return false;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const data = await getShareData(id);
    if (!data) return FALLBACK_META;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kitecredit.xyz";
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
    const proofValid = data ? verifyProof(data) : false;
    const isExpired = data?.expiresAt ? new Date(data.expiresAt) < new Date() : false;
    return <SharePageClient data={data} proofValid={proofValid} isExpired={isExpired} shareId={id} />;
}
