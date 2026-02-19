import { ImageResponse } from "next/og";
import { getShareData } from "@/lib/share";
import type { ShareData } from "@/types";

function getTier(score: number): string {
    if (score >= 800) return "Elite";
    if (score >= 700) return "Strong";
    if (score >= 600) return "Steady";
    return "Building";
}

const TIER_COLORS: Record<string, { bg: string; border: string }> = {
    Building: { bg: "#f59e0b", border: "#ea580c" },
    Steady: { bg: "#fb923c", border: "#38bdf8" },
    Strong: { bg: "#38bdf8", border: "#2563eb" },
    Elite: { bg: "#818cf8", border: "#7c3aed" },
};

function renderOgImage(data: ShareData | null) {
    const score = data?.cryptoScore ?? 0;
    const tier = data ? getTier(score) : "Building";
    const colors = TIER_COLORS[tier] || TIER_COLORS.Building;
    const hasDevScore = data?.devScore != null;
    const devTier = hasDevScore ? getTier(data!.devScore!) : null;

    return new ImageResponse(
        (
            <div
                style={{
                    width: "1200px",
                    height: "630px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                    fontFamily: "sans-serif",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "4px",
                        background: `linear-gradient(90deg, ${colors.bg}, ${colors.border})`,
                        display: "flex",
                    }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
                    <div
                        style={{
                            width: "24px",
                            height: "24px",
                            background: "#38bdf8",
                            transform: "rotate(45deg)",
                            display: "flex",
                        }}
                    />
                    <span style={{ color: "white", fontSize: "24px", fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase" as const }}>
                        Kite Credit
                    </span>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "40px",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "40px 60px",
                            borderRadius: "24px",
                            border: `2px solid ${colors.border}40`,
                            background: "rgba(15, 23, 42, 0.8)",
                        }}
                    >
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase" as const, marginBottom: "16px" }}>
                            Crypto Credit
                        </span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                            <span style={{ color: "white", fontSize: "96px", fontWeight: 900, lineHeight: 1 }}>
                                {score}
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "32px", fontWeight: 400 }}>
                                /1000
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
                            <div
                                style={{
                                    width: "14px",
                                    height: "14px",
                                    background: `linear-gradient(135deg, ${colors.bg}, ${colors.border})`,
                                    transform: "rotate(45deg)",
                                    display: "flex",
                                }}
                            />
                            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "28px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "2px" }}>
                                {tier}
                            </span>
                        </div>
                    </div>

                    {hasDevScore && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                padding: "40px 60px",
                                borderRadius: "24px",
                                border: "2px solid rgba(129, 140, 248, 0.25)",
                                background: "rgba(15, 23, 42, 0.8)",
                            }}
                        >
                            <span style={{ color: "rgba(165, 180, 252, 0.6)", fontSize: "14px", fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase" as const, marginBottom: "16px" }}>
                                Developer
                            </span>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                <span style={{ color: "white", fontSize: "96px", fontWeight: 900, lineHeight: 1 }}>
                                    {data!.devScore}
                                </span>
                                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "32px", fontWeight: 400 }}>
                                    /1000
                                </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
                                <div
                                    style={{
                                        width: "14px",
                                        height: "14px",
                                        background: "linear-gradient(135deg, #818cf8, #7c3aed)",
                                        transform: "rotate(45deg)",
                                        display: "flex",
                                    }}
                                />
                                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "28px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "2px" }}>
                                    {devTier}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {data?.proof && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "32px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", display: "flex" }} />
                        <span style={{ color: "rgba(110, 231, 183, 0.7)", fontSize: "13px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase" as const }}>
                            ZK Verified Attestation
                        </span>
                    </div>
                )}

                <div style={{ position: "absolute", bottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "14px", letterSpacing: "2px" }}>
                        kitecredit.xyz
                    </span>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const data = await getShareData(id);
    const response = renderOgImage(data);
    response.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
    return response;
}
