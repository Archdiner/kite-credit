// ---------------------------------------------------------------------------
// On-chain scoring tests (rescaled to 0-500)
// ---------------------------------------------------------------------------

import { scoreOnChain } from "../solana";
import type { OnChainData } from "@/types";

function makeData(overrides: Partial<OnChainData> = {}): OnChainData {
    return {
        walletAddress: "test",
        walletAgeDays: 0,
        totalTransactions: 0,
        deFiInteractions: [],
        stakingActive: false,
        stakingDurationDays: 0,
        solBalance: 0,
        stablecoinBalance: 0,
        ...overrides,
    };
}

describe("scoreOnChain", () => {
    it("returns 0 for an empty wallet", () => {
        const result = scoreOnChain(makeData());
        expect(result.score).toBe(0);
        expect(result.breakdown.walletAge).toBe(0);
    });

    it("scores wallet age progressively", () => {
        const day15 = scoreOnChain(makeData({ walletAgeDays: 15 }));
        const day90 = scoreOnChain(makeData({ walletAgeDays: 90 }));
        const day365 = scoreOnChain(makeData({ walletAgeDays: 365 }));

        expect(day15.breakdown.walletAge).toBeGreaterThan(0);
        expect(day90.breakdown.walletAge).toBeGreaterThan(day15.breakdown.walletAge);
        expect(day365.breakdown.walletAge).toBeGreaterThan(day90.breakdown.walletAge);
        expect(day365.breakdown.walletAge).toBeLessThanOrEqual(125);
    });

    it("caps DeFi activity at 165", () => {
        const maxed = scoreOnChain(
            makeData({
                deFiInteractions: [
                    { protocol: "jupiter", count: 500 },
                    { protocol: "raydium", count: 500 },
                    { protocol: "orca", count: 500 },
                    { protocol: "kamino", count: 500 },
                    { protocol: "solend", count: 500 },
                ],
            })
        );
        expect(maxed.breakdown.deFiActivity).toBeLessThanOrEqual(165);
    });

    it("scores staking up to 60", () => {
        const staked = scoreOnChain(
            makeData({ stakingActive: true, stakingDurationDays: 365 })
        );
        expect(staked.breakdown.staking).toBeGreaterThan(0);
        expect(staked.breakdown.staking).toBeLessThanOrEqual(60);
    });

    it("never exceeds 500 total", () => {
        const maxed = scoreOnChain(
            makeData({
                walletAgeDays: 5000,
                totalTransactions: 1000,
                deFiInteractions: [
                    { protocol: "jupiter", count: 500 },
                    { protocol: "raydium", count: 500 },
                    { protocol: "orca", count: 500 },
                    { protocol: "kamino", count: 500 },
                ],
                stakingActive: true,
                stakingDurationDays: 1000,
            })
        );
        expect(maxed.score).toBeLessThanOrEqual(500);
    });

    it("scores stablecoin capital up to 25", () => {
        const none = scoreOnChain(makeData({ stablecoinBalance: 0 }));
        expect(none.breakdown.stablecoinCapital).toBe(0);

        const small = scoreOnChain(makeData({ stablecoinBalance: 500 }));
        expect(small.breakdown.stablecoinCapital).toBeGreaterThan(0);
        expect(small.breakdown.stablecoinCapital).toBeLessThanOrEqual(25);

        const large = scoreOnChain(makeData({ stablecoinBalance: 100000 }));
        expect(large.breakdown.stablecoinCapital).toBe(25);
    });

    it("produces a score object with all required fields", () => {
        const result = scoreOnChain(makeData({ walletAgeDays: 200 }));
        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("breakdown");
        expect(result.breakdown).toHaveProperty("walletAge");
        expect(result.breakdown).toHaveProperty("deFiActivity");
        expect(result.breakdown).toHaveProperty("repaymentHistory");
        expect(result.breakdown).toHaveProperty("staking");
        expect(result.breakdown).toHaveProperty("stablecoinCapital");
    });
});
