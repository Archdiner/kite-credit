/**
 * @jest-environment node
 */
// ---------------------------------------------------------------------------
// Kite Credit — Ethereum Scoring Tests
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mock viem before any imports that depend on it
// ---------------------------------------------------------------------------

jest.mock("viem", () => ({
    createPublicClient: jest.fn(),
    http: jest.fn(),
    parseAbi: jest.fn(() => []),
    mainnet: { id: 1 },
}));

jest.mock("viem/chains", () => ({
    mainnet: { id: 1, name: "Ethereum" },
}));

// ---------------------------------------------------------------------------
// Mock Supabase and rate-limit
// ---------------------------------------------------------------------------

const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom };

jest.mock("@/lib/supabase", () => ({
    createServerSupabaseClient: jest.fn(() => mockSupabase),
}));

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { scoreEVM } from "@/lib/ethereum";
import { blendChainScores } from "@/lib/scoring";
import { NextRequest } from "next/server";
import { generateApiKey } from "@/lib/api-key-auth";
import type { EVMData, EVMScore, OnChainScore } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEVMData(overrides: Partial<EVMData> = {}): EVMData {
    return {
        chain: "ethereum",
        walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        walletAgeDays: 365,
        totalTransactions: 100,
        deFiInteractions: [
            { protocol: "aave_v3", count: 20, category: "lending" },
            { protocol: "uniswap_v3", count: 15, category: "dex" },
        ],
        lendingRepayments: 10,
        liquidationCount: 0,
        ethBalance: 2.5,
        stablecoinBalance: 5000,
        stakingBalance: 1.0,
        ...overrides,
    };
}

function makeOnChainScore(score: number): OnChainScore {
    return {
        score,
        breakdown: {
            walletAge: 80,
            deFiActivity: 100,
            repaymentHistory: 90,
            staking: 40,
            stablecoinCapital: 15,
        },
    };
}

function buildChain(overrides: Record<string, any> = {}) {
    const chain: Record<string, any> = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        ...overrides,
    };
    return chain;
}

// ---------------------------------------------------------------------------
// scoreEVM — unit tests
// ---------------------------------------------------------------------------

describe("scoreEVM — wallet age tiers", () => {
    it("0 days → 0 walletAge", () => {
        const s = scoreEVM(makeEVMData({ walletAgeDays: 0 }));
        expect(s.breakdown.walletAge).toBe(0);
    });

    it("15 days → partial score (0-30)", () => {
        const s = scoreEVM(makeEVMData({ walletAgeDays: 15 }));
        expect(s.breakdown.walletAge).toBeGreaterThan(0);
        expect(s.breakdown.walletAge).toBeLessThanOrEqual(30);
    });

    it("180 days → exactly 75 walletAge", () => {
        const s = scoreEVM(makeEVMData({ walletAgeDays: 180 }));
        expect(s.breakdown.walletAge).toBe(75);
    });

    it("730+ days → max 125 walletAge", () => {
        const s = scoreEVM(makeEVMData({ walletAgeDays: 1000 }));
        expect(s.breakdown.walletAge).toBe(125);
    });
});

describe("scoreEVM — DeFi activity scoring", () => {
    it("no DeFi → 0 deFiActivity", () => {
        const s = scoreEVM(makeEVMData({ deFiInteractions: [] }));
        expect(s.breakdown.deFiActivity).toBe(0);
    });

    it("single protocol adds diversity score", () => {
        const s = scoreEVM(makeEVMData({
            deFiInteractions: [{ protocol: "aave_v3", count: 5, category: "lending" }],
        }));
        expect(s.breakdown.deFiActivity).toBeGreaterThan(0);
    });

    it("multiple categories boost score via categoryBonus", () => {
        const multi = scoreEVM(makeEVMData({
            deFiInteractions: [
                { protocol: "aave_v3", count: 10, category: "lending" },
                { protocol: "uniswap_v3", count: 10, category: "dex" },
                { protocol: "lido", count: 10, category: "staking" },
            ],
        }));
        const single = scoreEVM(makeEVMData({
            deFiInteractions: [
                { protocol: "aave_v3", count: 30, category: "lending" },
            ],
        }));
        expect(multi.breakdown.deFiActivity).toBeGreaterThan(single.breakdown.deFiActivity);
    });

    it("deFiActivity capped at 165", () => {
        const s = scoreEVM(makeEVMData({
            deFiInteractions: [
                { protocol: "aave_v3", count: 1000, category: "lending" },
                { protocol: "aave_v2", count: 1000, category: "lending" },
                { protocol: "compound_v3", count: 1000, category: "lending" },
                { protocol: "uniswap_v3", count: 1000, category: "dex" },
                { protocol: "lido", count: 1000, category: "staking" },
            ],
        }));
        expect(s.breakdown.deFiActivity).toBeLessThanOrEqual(165);
    });
});

describe("scoreEVM — repayment history", () => {
    it("no repayments → 0 repaymentHistory", () => {
        const s = scoreEVM(makeEVMData({ lendingRepayments: 0, liquidationCount: 0 }));
        expect(s.breakdown.repaymentHistory).toBe(0);
    });

    it("repayments add 8 pts each (capped at 125)", () => {
        const s = scoreEVM(makeEVMData({ lendingRepayments: 5, liquidationCount: 0 }));
        expect(s.breakdown.repaymentHistory).toBe(40); // 5 * 8
    });

    it("liquidations subtract 15 pts each", () => {
        const s = scoreEVM(makeEVMData({ lendingRepayments: 5, liquidationCount: 1 }));
        expect(s.breakdown.repaymentHistory).toBe(25); // 40 - 15
    });

    it("liquidation penalty capped at 30 pts", () => {
        const s = scoreEVM(makeEVMData({ lendingRepayments: 10, liquidationCount: 5 }));
        const penalty = Math.min(30, 5 * 15); // = 30
        expect(s.breakdown.repaymentHistory).toBe(Math.max(0, 80 - penalty)); // 80 - 30 = 50
    });

    it("result cannot go below 0", () => {
        const s = scoreEVM(makeEVMData({ lendingRepayments: 0, liquidationCount: 10 }));
        expect(s.breakdown.repaymentHistory).toBe(0);
    });

    it("repaymentHistory capped at 125", () => {
        const s = scoreEVM(makeEVMData({ lendingRepayments: 100, liquidationCount: 0 }));
        expect(s.breakdown.repaymentHistory).toBe(125);
    });
});

describe("scoreEVM — staking scale", () => {
    it("0 staking balance → 0", () => {
        const s = scoreEVM(makeEVMData({ stakingBalance: 0 }));
        expect(s.breakdown.staking).toBe(0);
    });

    it("small staking balance → low score", () => {
        const s = scoreEVM(makeEVMData({ stakingBalance: 0.05 }));
        expect(s.breakdown.staking).toBe(3);
    });

    it("large staking balance → near max", () => {
        const s = scoreEVM(makeEVMData({ stakingBalance: 100 }));
        expect(s.breakdown.staking).toBeLessThanOrEqual(60);
        expect(s.breakdown.staking).toBeGreaterThan(40);
    });

    it("staking capped at 60", () => {
        const s = scoreEVM(makeEVMData({ stakingBalance: 999999 }));
        expect(s.breakdown.staking).toBe(60);
    });
});

describe("scoreEVM — stablecoin brackets", () => {
    it("< $1 → 0", () => {
        const s = scoreEVM(makeEVMData({ stablecoinBalance: 0 }));
        expect(s.breakdown.stablecoinCapital).toBe(0);
    });

    it("$100 → 5", () => {
        const s = scoreEVM(makeEVMData({ stablecoinBalance: 100 }));
        expect(s.breakdown.stablecoinCapital).toBe(5);
    });

    it("$10000 → 20", () => {
        const s = scoreEVM(makeEVMData({ stablecoinBalance: 10000 }));
        expect(s.breakdown.stablecoinCapital).toBe(20);
    });

    it("stablecoinCapital capped at 25", () => {
        const s = scoreEVM(makeEVMData({ stablecoinBalance: 999999 }));
        expect(s.breakdown.stablecoinCapital).toBe(25);
    });
});

describe("scoreEVM — total score", () => {
    it("total score is sum of components, capped at 500", () => {
        const s = scoreEVM(makeEVMData());
        const expected = s.breakdown.walletAge + s.breakdown.deFiActivity +
            s.breakdown.repaymentHistory + s.breakdown.staking + s.breakdown.stablecoinCapital;
        expect(s.score).toBe(Math.min(500, expected));
    });

    it("empty wallet → low score", () => {
        const s = scoreEVM(makeEVMData({
            walletAgeDays: 0,
            totalTransactions: 0,
            deFiInteractions: [],
            lendingRepayments: 0,
            liquidationCount: 0,
            ethBalance: 0,
            stablecoinBalance: 0,
            stakingBalance: 0,
        }));
        expect(s.score).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// analyzeEthereumData — returns null when ETHEREUM_RPC_URL not set
// ---------------------------------------------------------------------------

describe("analyzeEthereumData — env var gating", () => {
    it("returns null when ETHEREUM_RPC_URL is not set", async () => {
        const savedUrl = process.env.ETHEREUM_RPC_URL;
        delete process.env.ETHEREUM_RPC_URL;

        // Re-import to pick up the env change (module is already loaded, so we test via the client factory)
        const { analyzeEthereumData } = await import("@/lib/ethereum");
        const result = await analyzeEthereumData("0xabcdef1234567890abcdef1234567890abcdef12");
        expect(result).toBeNull();

        process.env.ETHEREUM_RPC_URL = savedUrl;
    });
});

// ---------------------------------------------------------------------------
// blendChainScores — unit tests
// ---------------------------------------------------------------------------

describe("blendChainScores", () => {
    it("equal strength → 50/50 blend", () => {
        const solana = makeOnChainScore(250);
        const evm: EVMScore = {
            score: 250,
            breakdown: { walletAge: 80, deFiActivity: 100, repaymentHistory: 40, staking: 20, stablecoinCapital: 10 },
        };
        const result = blendChainScores(solana, evm);
        // Each component should be midpoint
        expect(result.breakdown.walletAge).toBe(Math.floor(80 * 0.5 + 80 * 0.5));
    });

    it("dominant Solana → Solana score dominates", () => {
        const solana: OnChainScore = {
            score: 450,
            breakdown: { walletAge: 125, deFiActivity: 165, repaymentHistory: 100, staking: 40, stablecoinCapital: 20 },
        };
        const evm: EVMScore = {
            score: 50,
            breakdown: { walletAge: 10, deFiActivity: 15, repaymentHistory: 10, staking: 5, stablecoinCapital: 2 },
        };
        const result = blendChainScores(solana, evm);
        // Result should be closer to Solana values
        expect(result.breakdown.walletAge).toBeGreaterThan(evm.breakdown.walletAge);
    });

    it("result score is sum of blended breakdown, capped at 500", () => {
        const solana = makeOnChainScore(300);
        const evm: EVMScore = {
            score: 300,
            breakdown: { walletAge: 80, deFiActivity: 100, repaymentHistory: 70, staking: 30, stablecoinCapital: 20 },
        };
        const result = blendChainScores(solana, evm);
        const expected = result.breakdown.walletAge + result.breakdown.deFiActivity +
            result.breakdown.repaymentHistory + result.breakdown.staking + result.breakdown.stablecoinCapital;
        expect(result.score).toBe(Math.min(500, expected));
    });
});

// ---------------------------------------------------------------------------
// GET /api/score/by-wallet — ETH address detection
// ---------------------------------------------------------------------------

describe("GET /api/score/by-wallet/:address — ETH address handling", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFrom.mockReturnValue(buildChain());
    });

    it("returns 400 for invalid address format", async () => {
        const { GET } = await import("@/app/api/score/by-wallet/[address]/route");
        const req = new NextRequest("http://localhost/api/score/by-wallet/notanaddress");
        const res = await GET(req, { params: Promise.resolve({ address: "notanaddress" }) });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBeDefined();
    });

    it("returns 400 for invalid ETH address (wrong length)", async () => {
        const { GET } = await import("@/app/api/score/by-wallet/[address]/route");
        const req = new NextRequest("http://localhost/api/score/by-wallet/0xabcdef");
        const res = await GET(req, { params: Promise.resolve({ address: "0xabcdef" }) });
        expect(res.status).toBe(400);
    });

    it("returns found:false for valid ETH address not in DB", async () => {
        mockFrom.mockReturnValue(buildChain({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }));

        const { GET } = await import("@/app/api/score/by-wallet/[address]/route");
        const validEth = "0xabcdef1234567890abcdef1234567890abcdef12";
        const req = new NextRequest(`http://localhost/api/score/by-wallet/${validEth}`);
        const res = await GET(req, { params: Promise.resolve({ address: validEth }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.found).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// GET /api/lender/score/:address/detail — lender authentication and response
// ---------------------------------------------------------------------------

const testKey = generateApiKey();

function setupLenderAuth() {
    const lenderRecord = {
        id: "lender-123",
        key_prefix: testKey.keyPrefix,
        name: "Test Lender",
        email: "test@example.com",
        use_case: "testing",
        rate_limit: 1000,
        active: true,
    };

    mockFrom.mockImplementation((table: string) => {
        if (table === "lender_api_keys") {
            return buildChain({
                single: jest.fn().mockResolvedValue({ data: lenderRecord, error: null }),
            });
        }
        return buildChain();
    });
}

describe("GET /api/lender/score/:address/detail", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 401 when no API key provided", async () => {
        mockFrom.mockImplementation(() => buildChain({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }));

        const { GET } = await import("@/app/api/lender/score/[address]/detail/route");
        const req = new NextRequest("http://localhost/api/lender/score/addr/detail");
        const res = await GET(req, { params: Promise.resolve({ address: "someaddr" }) });
        expect(res.status).toBe(401);
    });

    it("returns 404 when address not found in DB", async () => {
        setupLenderAuth();

        // After auth, subsequent calls return no connection
        const lenderRecord = {
            id: "lender-123",
            key_prefix: testKey.keyPrefix,
            name: "Test Lender",
            email: "test@example.com",
            use_case: "testing",
            rate_limit: 1000,
            active: true,
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === "lender_api_keys") {
                return buildChain({
                    single: jest.fn().mockResolvedValue({ data: lenderRecord, error: null }),
                });
            }
            if (table === "user_connections") {
                return buildChain({
                    single: jest.fn().mockResolvedValue({ data: null, error: null }),
                });
            }
            return buildChain();
        });

        const { GET } = await import("@/app/api/lender/score/[address]/detail/route");
        const validSolana = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
        const req = new NextRequest(
            `http://localhost/api/lender/score/${validSolana}/detail`,
            { headers: { Authorization: `Bearer ${testKey.rawKey}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ address: validSolana }) });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.found).toBe(false);
    });

    it("returns 200 with five_factor breakdown on success", async () => {
        const lenderRecord = {
            id: "lender-123",
            key_prefix: testKey.keyPrefix,
            name: "Test Lender",
            email: "test@example.com",
            use_case: "testing",
            rate_limit: 1000,
            active: true,
        };

        const fakeScoreRow = {
            total_score: 742,
            tier: "Strong",
            sources: ["solana_active", "ethereum_active"],
            attestation: {
                kite_score: 742,
                tier: "Strong",
                verified_attributes: ["solana_active", "ethereum_active"],
                proof: "0xdeadbeef",
                issued_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                version: "1.0",
            },
            breakdown: {
                onChain: { score: 412, breakdown: { walletAge: 100, deFiActivity: 150, repaymentHistory: 100, staking: 40, stablecoinCapital: 22 } },
                financial: null,
                github: { score: 200, breakdown: {} },
                fiveFactor: {
                    paymentHistory: { score: 280, details: { onChainRepayments: 280, bankBillPay: 0 } },
                    utilization: { score: 210, details: { creditUtilization: 0, collateralHealth: 210, balanceRatio: 0 } },
                    creditAge: { score: 112, details: { walletAge: 112, accountAge: 0 } },
                    creditMix: { score: 75, details: { protocolDiversity: 75, accountDiversity: 0 } },
                    newCredit: { score: 65, details: { recentInquiries: 0, recentOpenings: 0 } },
                },
            },
            calculated_at: new Date().toISOString(),
        };

        const scoresSingle = jest.fn().mockResolvedValue({ data: fakeScoreRow, error: null });

        mockFrom.mockImplementation((table: string) => {
            if (table === "lender_api_keys") {
                return buildChain({
                    single: jest.fn().mockResolvedValue({ data: lenderRecord, error: null }),
                });
            }
            if (table === "user_connections") {
                return buildChain({
                    single: jest.fn().mockResolvedValue({ data: { user_id: "user-456" }, error: null }),
                });
            }
            if (table === "user_scores") {
                return buildChain({ single: scoresSingle });
            }
            return buildChain();
        });

        const { GET } = await import("@/app/api/lender/score/[address]/detail/route");
        const validSolana = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
        const req = new NextRequest(
            `http://localhost/api/lender/score/${validSolana}/detail`,
            { headers: { Authorization: `Bearer ${testKey.rawKey}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ address: validSolana }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.found).toBe(true);
        expect(body.score).toBe(742);
        expect(body.tier).toBe("Strong");
        expect(body.five_factor).toBeDefined();
        expect(body.five_factor.payment_history).toEqual({ score: 280, max: 350 });
        expect(body.five_factor.utilization).toEqual({ score: 210, max: 300 });
        expect(body.five_factor.credit_age).toEqual({ score: 112, max: 150 });
        expect(body.five_factor.credit_mix).toEqual({ score: 75, max: 100 });
        expect(body.five_factor.new_credit).toEqual({ score: 65, max: 100 });
        expect(body.sources.on_chain.chains).toContain("solana");
        expect(body.sources.on_chain.chains).toContain("ethereum");
        expect(body.sources.github.connected).toBe(true);
        expect(body.sources.financial.connected).toBe(false);
    });
});
