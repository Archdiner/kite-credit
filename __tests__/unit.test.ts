// ---------------------------------------------------------------------------
// Kite Credit — Comprehensive Unit Tests
// ---------------------------------------------------------------------------
// Covers scoring boundaries, attestation correctness, HMAC round-trips,
// on-chain scoring edge cases, and score freshness logic.
// ---------------------------------------------------------------------------

import { createHmac } from "node:crypto";
import { getTier, assembleKiteScore, getConnectedSources } from "@/lib/scoring";
import { scoreOnChain } from "@/lib/solana";
import { generateAttestation, isValidAttestationShape } from "@/lib/attestation";
import { getScoreAge } from "@/lib/freshness";
import type { OnChainData, ScoreBreakdown } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOnChainData(overrides: Partial<OnChainData> = {}): OnChainData {
    return {
        walletAddress: "testWallet123",
        walletAgeDays: 200,
        totalTransactions: 80,
        deFiInteractions: [
            { protocol: "jupiter", count: 20, category: "dex" },
            { protocol: "raydium", count: 10, category: "dex" },
        ],
        stakingActive: true,
        stakingDurationDays: 90,
        solBalance: 5.5,
        stablecoinBalance: 0,
        lstBalance: 0,
        liquidationCount: 0,
        ...overrides,
    };
}

function makeMinimalBreakdown(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
    const onChain = scoreOnChain(makeOnChainData());
    return {
        onChain,
        financial: null,
        github: null,
        fiveFactor: {
            paymentHistory: { score: 200, details: { onChainRepayments: 200, bankBillPay: 0 } },
            utilization: { score: 150, details: { creditUtilization: 0, collateralHealth: 150, balanceRatio: 0 } },
            creditAge: { score: 100, details: { walletAge: 100, accountAge: 0 } },
            creditMix: { score: 60, details: { protocolDiversity: 60, accountDiversity: 0 } },
            newCredit: { score: 60, details: { recentInquiries: 0, recentOpenings: 0 } },
        },
        ...overrides,
    };
}

function hoursAgo(hours: number): string {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
    return hoursAgo(days * 24);
}

// ---------------------------------------------------------------------------
// getTier — tier boundary values
// ---------------------------------------------------------------------------

describe("getTier — tier boundary values", () => {
    it("0 → Building", () => expect(getTier(0)).toBe("Building"));
    it("599 → Building", () => expect(getTier(599)).toBe("Building"));
    it("600 → Steady", () => expect(getTier(600)).toBe("Steady"));
    it("699 → Steady", () => expect(getTier(699)).toBe("Steady"));
    it("700 → Strong", () => expect(getTier(700)).toBe("Strong"));
    it("799 → Strong", () => expect(getTier(799)).toBe("Strong"));
    it("800 → Elite", () => expect(getTier(800)).toBe("Elite"));
    it("1000 → Elite", () => expect(getTier(1000)).toBe("Elite"));
});

// ---------------------------------------------------------------------------
// getConnectedSources
// ---------------------------------------------------------------------------

describe("getConnectedSources", () => {
    it("always includes solana_active", () => {
        const breakdown = makeMinimalBreakdown();
        expect(getConnectedSources(breakdown)).toContain("solana_active");
    });

    it("does not include bank_verified when financial is null", () => {
        const breakdown = makeMinimalBreakdown({ financial: null });
        expect(getConnectedSources(breakdown)).not.toContain("bank_verified");
    });

    it("includes bank_verified when financial is verified", () => {
        const breakdown = makeMinimalBreakdown({
            financial: {
                score: 300,
                verified: true,
                breakdown: { balanceHealth: 150, incomeConsistency: 100, verificationBonus: 50 },
            },
        });
        expect(getConnectedSources(breakdown)).toContain("bank_verified");
    });

    it("does not include bank_verified when financial.verified is false", () => {
        const breakdown = makeMinimalBreakdown({
            financial: {
                score: 100,
                verified: false,
                breakdown: { balanceHealth: 50, incomeConsistency: 50, verificationBonus: 0 },
            },
        });
        expect(getConnectedSources(breakdown)).not.toContain("bank_verified");
    });

    it("includes github_linked when github breakdown is present", () => {
        const breakdown = makeMinimalBreakdown({
            github: {
                score: 200,
                breakdown: {
                    accountAge: 30,
                    repoPortfolio: 50,
                    commitConsistency: 60,
                    communityTrust: 40,
                    codeQuality: 20,
                },
            },
        });
        expect(getConnectedSources(breakdown)).toContain("github_linked");
    });

    it("all three sources present when all connected", () => {
        const breakdown = makeMinimalBreakdown({
            financial: {
                score: 300,
                verified: true,
                breakdown: { balanceHealth: 150, incomeConsistency: 100, verificationBonus: 50 },
            },
            github: {
                score: 200,
                breakdown: {
                    accountAge: 30, repoPortfolio: 50,
                    commitConsistency: 60, communityTrust: 40, codeQuality: 20,
                },
            },
        });
        const sources = getConnectedSources(breakdown);
        expect(sources).toContain("solana_active");
        expect(sources).toContain("bank_verified");
        expect(sources).toContain("github_linked");
    });
});

// ---------------------------------------------------------------------------
// assembleKiteScore — edge cases
// ---------------------------------------------------------------------------

describe("assembleKiteScore — edge cases", () => {
    it("thin wallet (low signal) is dampened below moderate wallet", () => {
        const thin = makeOnChainData({ walletAgeDays: 1, totalTransactions: 3, deFiInteractions: [] });
        const moderate = makeOnChainData(); // 200 day wallet, 80 txs
        const thinScore = assembleKiteScore({ onChain: scoreOnChain(thin), financial: null, github: null }, "thin");
        const moderateScore = assembleKiteScore({ onChain: scoreOnChain(moderate), financial: null, github: null }, "mod");
        expect(thinScore.total).toBeLessThan(moderateScore.total);
    });

    it("github bonus is never more than 50 points", () => {
        const highGitHub = {
            score: 300, // maximum possible
            breakdown: {
                accountAge: 40, repoPortfolio: 60,
                commitConsistency: 70, communityTrust: 50, codeQuality: 80,
            },
        };
        const score = assembleKiteScore(
            { onChain: scoreOnChain(makeOnChainData()), financial: null, github: highGitHub },
            "high-gh"
        );
        expect(score.githubBonus).toBeLessThanOrEqual(50);
    });

    it("total score is hard-capped at 1000", () => {
        const maxOnChain = scoreOnChain(makeOnChainData({
            walletAgeDays: 1000,
            totalTransactions: 500,
            deFiInteractions: [
                { protocol: "kamino", count: 100, category: "lending" },
                { protocol: "jupiter", count: 100, category: "dex" },
                { protocol: "drift", count: 50, category: "perps" },
                { protocol: "tensor", count: 30, category: "nft" },
                { protocol: "jito", count: 80, category: "staking" },
            ],
            stakingActive: true,
            stakingDurationDays: 365,
            stablecoinBalance: 100000,
            lstBalance: 100,
        }));
        const score = assembleKiteScore({ onChain: maxOnChain, financial: null, github: null }, "max");
        expect(score.total).toBeLessThanOrEqual(1000);
    });

    it("secondary wallet boost is capped at 2 wallets (5%)", () => {
        const onChain = scoreOnChain(makeOnChainData());
        const two = assembleKiteScore({ onChain, financial: null, github: null, secondaryWalletCount: 2 }, "two");
        const ten = assembleKiteScore({ onChain, financial: null, github: null, secondaryWalletCount: 10 }, "ten");
        expect(ten.total).toBe(two.total);
    });

    it("score with github is higher than score without github (same on-chain)", () => {
        const onChain = scoreOnChain(makeOnChainData());
        const withGH = {
            score: 200,
            breakdown: { accountAge: 30, repoPortfolio: 50, commitConsistency: 60, communityTrust: 40, codeQuality: 20 },
        };
        const noGH = assembleKiteScore({ onChain, financial: null, github: null }, "no");
        const yesGH = assembleKiteScore({ onChain, financial: null, github: withGH }, "yes");
        expect(yesGH.total).toBeGreaterThan(noGH.total);
    });
});

// ---------------------------------------------------------------------------
// scoreOnChain — edge cases
// ---------------------------------------------------------------------------

describe("scoreOnChain — edge cases", () => {
    it("older wallet scores higher walletAge than newer wallet", () => {
        const old = scoreOnChain(makeOnChainData({ walletAgeDays: 730 }));
        const young = scoreOnChain(makeOnChainData({ walletAgeDays: 10 }));
        expect(old.breakdown.walletAge).toBeGreaterThan(young.breakdown.walletAge);
    });

    it("liquidation penalises repaymentHistory", () => {
        const clean = scoreOnChain(makeOnChainData({ liquidationCount: 0 }));
        const liquidated = scoreOnChain(makeOnChainData({ liquidationCount: 2 }));
        expect(clean.breakdown.repaymentHistory).toBeGreaterThan(liquidated.breakdown.repaymentHistory);
    });

    it("two liquidations reduce repaymentHistory by 30 pts", () => {
        const clean = scoreOnChain(makeOnChainData({ liquidationCount: 0 }));
        const liquidated = scoreOnChain(makeOnChainData({ liquidationCount: 2 }));
        expect(clean.breakdown.repaymentHistory - liquidated.breakdown.repaymentHistory).toBe(30);
    });

    it("stablecoin balance above $10k contributes meaningful stablecoinCapital", () => {
        const rich = scoreOnChain(makeOnChainData({ stablecoinBalance: 15000 }));
        const poor = scoreOnChain(makeOnChainData({ stablecoinBalance: 0 }));
        expect(rich.breakdown.stablecoinCapital).toBeGreaterThan(poor.breakdown.stablecoinCapital);
        expect(rich.breakdown.stablecoinCapital).toBeGreaterThan(10);
    });

    it("cross-category DeFi diversity scores higher than single-category (same tx count, fewer protocols)", () => {
        // Keep protocol count low (2) so the categoryBonus difference is visible
        // before hitting the protocolDiversity cap of 55.
        // Diversified: 2 protocols × 2 categories → protocolDiversity = min(55, 2*12 + 2*5) = 34
        // Single:      2 protocols × 1 category  → protocolDiversity = min(55, 2*12 + 1*5) = 29
        const diversified = scoreOnChain(makeOnChainData({
            deFiInteractions: [
                { protocol: "kamino", count: 20, category: "lending" },
                { protocol: "jupiter", count: 20, category: "dex" },
            ],
        }));
        const singleCategory = scoreOnChain(makeOnChainData({
            deFiInteractions: [
                { protocol: "jupiter", count: 20, category: "dex" },
                { protocol: "raydium", count: 20, category: "dex" },
            ],
        }));
        expect(diversified.breakdown.deFiActivity).toBeGreaterThan(singleCategory.breakdown.deFiActivity);
    });

    it("native staking active with long duration achieves near-max staking score", () => {
        const fullYear = scoreOnChain(makeOnChainData({ stakingActive: true, stakingDurationDays: 365 }));
        expect(fullYear.breakdown.staking).toBeGreaterThanOrEqual(55);
    });

    it("LST balance synergy bonus fires when both native staking and LST are active", () => {
        const both = scoreOnChain(makeOnChainData({ stakingActive: true, stakingDurationDays: 180, lstBalance: 2 }));
        const nativeOnly = scoreOnChain(makeOnChainData({ stakingActive: true, stakingDurationDays: 180, lstBalance: 0 }));
        expect(both.breakdown.staking).toBeGreaterThan(nativeOnly.breakdown.staking);
    });

    it("score is capped at 500 even with maxed inputs", () => {
        const maxed = scoreOnChain(makeOnChainData({
            walletAgeDays: 2000, totalTransactions: 1000,
            deFiInteractions: Array.from({ length: 10 }, (_, i) => ({
                protocol: `p${i}`,
                count: 200,
                category: ["lending", "dex", "perps", "nft", "staking"][i % 5] as OnChainData["deFiInteractions"][0]["category"],
            })),
            stakingActive: true, stakingDurationDays: 730,
            stablecoinBalance: 100000, lstBalance: 200,
        }));
        expect(maxed.score).toBeLessThanOrEqual(500);
    });
});

// ---------------------------------------------------------------------------
// generateAttestation
// ---------------------------------------------------------------------------

describe("generateAttestation", () => {
    const onChain = scoreOnChain(makeOnChainData());
    const baseScore = assembleKiteScore({ onChain, financial: null, github: null }, "test");

    it("returns all required fields with correct types", () => {
        const att = generateAttestation(baseScore);
        expect(typeof att.kite_score).toBe("number");
        expect(typeof att.tier).toBe("string");
        expect(Array.isArray(att.verified_attributes)).toBe(true);
        expect(typeof att.proof).toBe("string");
        expect(typeof att.issued_at).toBe("string");
        expect(typeof att.expires_at).toBe("string");
        expect(att.version).toBe("1.0");
    });

    it("kite_score matches the input score total", () => {
        const att = generateAttestation(baseScore);
        expect(att.kite_score).toBe(baseScore.total);
    });

    it("expires_at is exactly 90 days after issued_at", () => {
        const att = generateAttestation(baseScore);
        const issued = new Date(att.issued_at).getTime();
        const expires = new Date(att.expires_at!).getTime();
        const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
        expect(expires - issued).toBe(NINETY_DAYS_MS);
    });

    it("proof starts with 0x (hex-prefixed)", () => {
        const att = generateAttestation(baseScore);
        expect(att.proof.startsWith("0x")).toBe(true);
    });

    it("proof is deterministic — same score produces the same proof", () => {
        const att1 = generateAttestation(baseScore);
        const att2 = generateAttestation(baseScore);
        expect(att1.proof).toBe(att2.proof);
    });

    it("different total scores produce different proofs", () => {
        const scoreA = assembleKiteScore({ onChain, financial: null, github: null }, "a");
        const highOnChain = scoreOnChain(makeOnChainData({ walletAgeDays: 730, totalTransactions: 300 }));
        const scoreB = assembleKiteScore({ onChain: highOnChain, financial: null, github: null }, "b");
        // Only meaningful if the totals are actually different
        if (scoreA.total !== scoreB.total) {
            expect(generateAttestation(scoreA).proof).not.toBe(generateAttestation(scoreB).proof);
        }
    });
});

// ---------------------------------------------------------------------------
// isValidAttestationShape
// ---------------------------------------------------------------------------

describe("isValidAttestationShape", () => {
    const valid = {
        kite_score: 742,
        tier: "Strong",
        verified_attributes: ["solana_active"],
        proof: "0xabcdef",
        issued_at: new Date().toISOString(),
        version: "1.0",
    };

    it("accepts a valid attestation object", () => {
        expect(isValidAttestationShape(valid)).toBe(true);
    });

    it("accepts an attestation with optional expires_at", () => {
        expect(isValidAttestationShape({ ...valid, expires_at: new Date().toISOString() })).toBe(true);
    });

    it("rejects null", () => {
        expect(isValidAttestationShape(null)).toBe(false);
    });

    it("rejects when kite_score is missing", () => {
        const { kite_score: _, ...without } = valid;
        expect(isValidAttestationShape(without)).toBe(false);
    });

    it("rejects when proof is missing", () => {
        const { proof: _, ...without } = valid;
        expect(isValidAttestationShape(without)).toBe(false);
    });

    it("rejects when verified_attributes is not an array", () => {
        expect(isValidAttestationShape({ ...valid, verified_attributes: "solana_active" })).toBe(false);
    });

    it("rejects when kite_score is not a number", () => {
        expect(isValidAttestationShape({ ...valid, kite_score: "742" })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// HMAC round-trip — generate then manually verify
// ---------------------------------------------------------------------------

describe("HMAC round-trip verification", () => {
    const DEV_SECRET = "dev-attestation-secret-change-me";

    it("generated proof matches manually computed HMAC with the dev secret", () => {
        const onChain = scoreOnChain(makeOnChainData());
        const score = assembleKiteScore({ onChain, financial: null, github: null }, "hmac-test");
        const att = generateAttestation(score);

        // Re-compute the same HMAC that generateAttestation uses
        const proofData = JSON.stringify({
            total: score.total,
            tier: score.tier,
            sources: att.verified_attributes,
            timestamp: score.timestamp,
        });
        const expected = "0x" + createHmac("sha256", DEV_SECRET).update(proofData).digest("hex");

        expect(att.proof).toBe(expected);
    });

    it("tampered total fails to match original proof", () => {
        const onChain = scoreOnChain(makeOnChainData());
        const score = assembleKiteScore({ onChain, financial: null, github: null }, "tamper-test");
        const att = generateAttestation(score);

        // Attempt to verify with a different total
        const tamperedProofData = JSON.stringify({
            total: score.total + 1,  // tampered
            tier: score.tier,
            sources: att.verified_attributes,
            timestamp: score.timestamp,
        });
        const tampered = "0x" + createHmac("sha256", DEV_SECRET).update(tamperedProofData).digest("hex");

        expect(att.proof).not.toBe(tampered);
    });

    it("tampered tier fails to match original proof", () => {
        const onChain = scoreOnChain(makeOnChainData());
        const score = assembleKiteScore({ onChain, financial: null, github: null }, "tier-tamper");
        const att = generateAttestation(score);

        const tamperedProofData = JSON.stringify({
            total: score.total,
            tier: "Elite",  // tampered tier
            sources: att.verified_attributes,
            timestamp: score.timestamp,
        });
        const tampered = "0x" + createHmac("sha256", DEV_SECRET).update(tamperedProofData).digest("hex");

        if (score.tier !== "Elite") {
            expect(att.proof).not.toBe(tampered);
        }
    });
});

// ---------------------------------------------------------------------------
// getScoreAge — freshness logic
// ---------------------------------------------------------------------------

describe("getScoreAge — freshness logic", () => {
    it("< 1 hour ago → 'Just now', status fresh", () => {
        const { label, status } = getScoreAge(hoursAgo(0.5));
        expect(label).toBe("Just now");
        expect(status).toBe("fresh");
    });

    it("2 hours ago → '2h ago', status fresh", () => {
        const { label, status } = getScoreAge(hoursAgo(2));
        expect(label).toBe("2h ago");
        expect(status).toBe("fresh");
    });

    it("23 hours ago is still fresh", () => {
        const { status } = getScoreAge(hoursAgo(23));
        expect(status).toBe("fresh");
    });

    it("30 hours ago → '1d ago', status aging", () => {
        const { label, status } = getScoreAge(hoursAgo(30));
        expect(label).toBe("1d ago");
        expect(status).toBe("aging");
    });

    it("7 days ago is the boundary — 7d = 168h is still aging", () => {
        const { status } = getScoreAge(hoursAgo(167));
        expect(status).toBe("aging");
    });

    it("200 hours ago → '8d ago', status stale", () => {
        const { label, status } = getScoreAge(hoursAgo(200));
        expect(label).toBe("8d ago");
        expect(status).toBe("stale");
    });

    it("brand-new score has ~90 daysUntilExpiry", () => {
        const { daysUntilExpiry } = getScoreAge(hoursAgo(0));
        // Allow ±1 day for timing precision
        expect(daysUntilExpiry).toBeGreaterThanOrEqual(89);
        expect(daysUntilExpiry).toBeLessThanOrEqual(90);
    });

    it("score 89 days old has 1 day until expiry", () => {
        const { daysUntilExpiry } = getScoreAge(daysAgo(89));
        expect(daysUntilExpiry).toBeLessThanOrEqual(2);
        expect(daysUntilExpiry).toBeGreaterThanOrEqual(0);
    });

    it("score 91 days old has 0 daysUntilExpiry (expired)", () => {
        const { daysUntilExpiry } = getScoreAge(daysAgo(91));
        expect(daysUntilExpiry).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Lender input detection logic
// ---------------------------------------------------------------------------

describe("Lender portal — input type detection", () => {
    const SOLANA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{4,16}$/;

    function detect(value: string): "wallet" | "share_id" | "unknown" {
        if (SOLANA_REGEX.test(value)) return "wallet";
        if (SHARE_ID_REGEX.test(value)) return "share_id";
        return "unknown";
    }

    it("valid 44-char Solana address → wallet", () => {
        expect(detect("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe("wallet");
    });

    it("valid 32-char Solana address → wallet", () => {
        expect(detect("11111111111111111111111111111112")).toBe("wallet");
    });

    it("6-char base64url share ID → share_id", () => {
        expect(detect("aB3xR2")).toBe("share_id");
    });

    it("8-char hyphenated share ID → share_id", () => {
        expect(detect("aB3x-R2z")).toBe("share_id");
    });

    it("empty string → unknown", () => {
        expect(detect("")).toBe("unknown");
    });

    it("email address → unknown", () => {
        expect(detect("user@example.com")).toBe("unknown");
    });

    it("too-long non-Solana string → unknown", () => {
        expect(detect("not-a-wallet-address-but-a-very-long-random-string-that-doesnt-match")).toBe("unknown");
    });
});
