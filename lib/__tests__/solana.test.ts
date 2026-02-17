// ---------------------------------------------------------------------------
// On-chain scoring tests
// ---------------------------------------------------------------------------

import { scoreOnChain } from "../solana";
import type { OnChainData } from "@/types";

function makeData(overrides: Partial<OnChainData> = {}): OnChainData {
    return {
        walletAddress: "11111111111111111111111111111111",
        walletAgeDays: 0,
        totalTransactions: 0,
        deFiInteractions: [],
        stakingActive: false,
        stakingDurationDays: 0,
        ...overrides,
    };
}

describe("scoreOnChain", () => {
    it("returns 0 for a brand-new empty wallet", () => {
        const result = scoreOnChain(makeData());
        expect(result.score).toBe(0);
        expect(result.breakdown.walletAge).toBe(0);
        expect(result.breakdown.deFiActivity).toBe(0);
        expect(result.breakdown.repaymentHistory).toBe(0);
        expect(result.breakdown.staking).toBe(0);
    });

    it("scores wallet age progressively", () => {
        const day30 = scoreOnChain(makeData({ walletAgeDays: 30 }));
        const day180 = scoreOnChain(makeData({ walletAgeDays: 180 }));
        const day365 = scoreOnChain(makeData({ walletAgeDays: 365 }));
        const day730 = scoreOnChain(makeData({ walletAgeDays: 730 }));

        expect(day30.breakdown.walletAge).toBe(25);
        expect(day180.breakdown.walletAge).toBe(60);
        expect(day365.breakdown.walletAge).toBeGreaterThan(60);
        expect(day730.breakdown.walletAge).toBe(100);
    });

    it("caps DeFi activity at 150", () => {
        const result = scoreOnChain(
            makeData({
                totalTransactions: 200,
                deFiInteractions: [
                    { protocol: "kamino", count: 100 },
                    { protocol: "solend", count: 100 },
                    { protocol: "marinade", count: 100 },
                    { protocol: "jupiter", count: 100 },
                    { protocol: "raydium", count: 100 },
                ],
            })
        );
        expect(result.breakdown.deFiActivity).toBeLessThanOrEqual(150);
    });

    it("scores staking correctly", () => {
        const noStake = scoreOnChain(makeData({ stakingActive: false }));
        const newStake = scoreOnChain(
            makeData({ stakingActive: true, stakingDurationDays: 0 })
        );
        const longStake = scoreOnChain(
            makeData({ stakingActive: true, stakingDurationDays: 365 })
        );

        expect(noStake.breakdown.staking).toBe(0);
        expect(newStake.breakdown.staking).toBe(10);
        expect(longStake.breakdown.staking).toBe(50);
    });

    it("never exceeds 400 total", () => {
        const maxed = scoreOnChain(
            makeData({
                walletAgeDays: 1000,
                totalTransactions: 500,
                deFiInteractions: [
                    { protocol: "kamino", count: 200 },
                    { protocol: "solend", count: 200 },
                    { protocol: "marinade", count: 200 },
                    { protocol: "jupiter", count: 200 },
                ],
                stakingActive: true,
                stakingDurationDays: 500,
            })
        );
        expect(maxed.score).toBeLessThanOrEqual(400);
    });

    it("produces a score object with all required fields", () => {
        const result = scoreOnChain(makeData({ walletAgeDays: 100 }));
        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("breakdown");
        expect(result.breakdown).toHaveProperty("walletAge");
        expect(result.breakdown).toHaveProperty("deFiActivity");
        expect(result.breakdown).toHaveProperty("repaymentHistory");
        expect(result.breakdown).toHaveProperty("staking");
    });
});
