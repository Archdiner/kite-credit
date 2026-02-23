import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import ScoreDisplay from "@/components/dashboard/ScoreDisplay";
import ScoreBreakdownPanel from "@/components/dashboard/ScoreBreakdownPanel";
import AttestationCard from "@/components/dashboard/AttestationCard";
import ShareScoreCard from "@/components/dashboard/ShareScoreCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import { scoreGitHub } from "@/lib/github";
import { scoreOnChain } from "@/lib/solana";
import { assembleKiteScore, getTier } from "@/lib/scoring";
import { generateMockProof, scoreFinancial } from "@/lib/reclaim";
import type { KiteScore, ZKAttestation, OnChainData, GitHubData } from "@/types";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeGitHubData(overrides: Partial<GitHubData> = {}): GitHubData {
    return {
        username: "testdev",
        accountAgeDays: 500,
        publicRepos: 15,
        totalStars: 30,
        followers: 20,
        recentCommitCount: 40,
        longestRepoAgeDays: 400,
        recentActiveWeeks: 8,
        languageDiversity: 4,
        ownerReputation: 25,
        originalityScore: 0.7,
        reposWithReadme: 6,
        reposWithCI: 4,
        totalPRsMerged: 20,
        totalIssuesClosed: 10,
        codeReviewCount: 8,
        avgRepoSize: 1200,
        topRepoTestIndicator: 0.5,
        ...overrides,
    };
}

function makeOnChainData(overrides: Partial<OnChainData> = {}): OnChainData {
    return {
        walletAddress: "testAddress123",
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

function makeMockKiteScore(overrides: Partial<KiteScore> = {}): KiteScore {
    const onChain = scoreOnChain(makeOnChainData());
    const github = scoreGitHub(makeGitHubData());
    return {
        total: 750,
        tier: "Strong",
        breakdown: {
            onChain,
            financial: null,
            github,
            fiveFactor: {
                paymentHistory: { score: 250, details: { onChainRepayments: 250, bankBillPay: 0 } },
                utilization: { score: 200, details: { creditUtilization: 0, collateralHealth: 200, balanceRatio: 0 } },
                creditAge: { score: 120, details: { walletAge: 120, accountAge: 0 } },
                creditMix: { score: 70, details: { protocolDiversity: 70, accountDiversity: 0 } },
                newCredit: { score: 75, details: { recentInquiries: 0, recentOpenings: 0 } },
            },
        },
        githubBonus: 33,
        explanation: "Strong on-chain profile with consistent DeFi activity.",
        timestamp: new Date().toISOString(),
        ...overrides,
    };
}

function makeMockAttestation(): ZKAttestation {
    return {
        kite_score: 750,
        tier: "Strong",
        verified_attributes: ["solana_active", "github_linked"],
        proof: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
        issued_at: new Date().toISOString(),
        version: "1.0",
    };
}

// ---------------------------------------------------------------------------
// Scoring Logic E2E
// ---------------------------------------------------------------------------

describe("End-to-End Scoring Pipeline", () => {
    it("full pipeline: on-chain -> financial -> github -> assembled score", () => {
        const onChainData = makeOnChainData();
        const onChainScore = scoreOnChain(onChainData);

        const financialData = generateMockProof({ balance: 15000 });
        const financialScore = scoreFinancial(financialData);

        const githubData = makeGitHubData();
        const githubScore = scoreGitHub(githubData);

        const kiteScore = assembleKiteScore(
            { onChain: onChainScore, financial: financialScore, github: githubScore },
            "E2E test"
        );

        expect(kiteScore.total).toBeGreaterThan(0);
        expect(kiteScore.total).toBeLessThanOrEqual(1000);
        expect(["Building", "Steady", "Strong", "Elite"]).toContain(kiteScore.tier);
        expect(kiteScore.breakdown.fiveFactor).toBeDefined();
        expect(kiteScore.githubBonus).toBeGreaterThanOrEqual(0);
    });

    it("pipeline with no optional sources still produces valid score", () => {
        const onChainData = makeOnChainData({ walletAgeDays: 10, totalTransactions: 5 });
        const onChainScore = scoreOnChain(onChainData);

        const kiteScore = assembleKiteScore(
            { onChain: onChainScore, financial: null, github: null },
            "Minimal"
        );

        expect(kiteScore.total).toBeGreaterThan(0);
        expect(kiteScore.tier).toBe("Building");
        expect(kiteScore.githubBonus).toBe(0);
    });

    it("code quality differentiates developers with same activity volume", () => {
        const baseProfile = {
            accountAgeDays: 500,
            publicRepos: 20,
            recentCommitCount: 50,
            recentActiveWeeks: 10,
            followers: 10,
        };

        const hobbyist = scoreGitHub(makeGitHubData({
            ...baseProfile,
            originalityScore: 0.3,
            reposWithReadme: 2,
            reposWithCI: 0,
            topRepoTestIndicator: 0,
            totalPRsMerged: 5,
            codeReviewCount: 0,
        }));

        const professional = scoreGitHub(makeGitHubData({
            ...baseProfile,
            originalityScore: 0.9,
            reposWithReadme: 9,
            reposWithCI: 7,
            topRepoTestIndicator: 0.8,
            totalPRsMerged: 80,
            codeReviewCount: 40,
        }));

        expect(professional.score).toBeGreaterThan(hobbyist.score);
        expect(professional.breakdown.codeQuality).toBeGreaterThan(hobbyist.breakdown.codeQuality * 2);
    });
});

// ---------------------------------------------------------------------------
// ScoreDisplay Component
// ---------------------------------------------------------------------------

describe("ScoreDisplay Component", () => {
    const mockScore = makeMockKiteScore();

    it("renders crypto tab by default", () => {
        render(<ScoreDisplay score={mockScore} />);
        const cryptoScore = mockScore.total - (mockScore.githubBonus || 0);
        expect(screen.getByText(String(cryptoScore))).toBeInTheDocument();
    });

    it("switches to developer tab when clicked", () => {
        render(<ScoreDisplay score={mockScore} />);
        fireEvent.click(screen.getByText("Developer"));
        const devNormalized = Math.min(1000, Math.floor((mockScore.breakdown.github!.score / 300) * 1000));
        expect(screen.getByText(String(devNormalized))).toBeInTheDocument();
    });

    it("only shows Crypto and Developer tabs — no Unified tab", () => {
        render(<ScoreDisplay score={mockScore} />);
        expect(screen.getByText("Crypto")).toBeInTheDocument();
        expect(screen.getByText("Developer")).toBeInTheDocument();
        expect(screen.queryByText("Unified")).not.toBeInTheDocument();
    });

    it("dev tab shows raw score badge", () => {
        render(<ScoreDisplay score={mockScore} />);
        fireEvent.click(screen.getByText("Developer"));
        const devScoreRaw = mockScore.breakdown.github!.score;
        expect(screen.getByText(`Raw: ${devScoreRaw}/300`)).toBeInTheDocument();
    });

    it("disables dev tab when github is not connected", () => {
        const noGithub = makeMockKiteScore({
            breakdown: {
                ...mockScore.breakdown,
                github: null,
            },
            githubBonus: 0,
        });
        render(<ScoreDisplay score={noGithub} />);
        const devBtn = screen.getByText("Dev ✦");
        expect(devBtn).toBeDisabled();
    });

    it("displays the correct crypto score number", () => {
        render(<ScoreDisplay score={mockScore} />);
        const cryptoScore = mockScore.total - (mockScore.githubBonus || 0);
        // Score appears in both the circle and possibly elsewhere; getAllByText handles multiples
        const matches = screen.getAllByText(String(cryptoScore));
        expect(matches.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// ScoreBreakdownPanel Component
// ---------------------------------------------------------------------------

describe("ScoreBreakdownPanel Component", () => {
    const mockScore = makeMockKiteScore();

    it("renders all five score factors", () => {
        render(<ScoreBreakdownPanel breakdown={mockScore.breakdown} />);
        expect(screen.getByText("Payment History")).toBeInTheDocument();
        expect(screen.getByText("Utilization")).toBeInTheDocument();
        expect(screen.getByText("Credit Age")).toBeInTheDocument();
        expect(screen.getByText("Credit Mix")).toBeInTheDocument();
        expect(screen.getByText("New Credit")).toBeInTheDocument();
    });

    it("shows GitHub developer score section when github is connected", () => {
        render(<ScoreBreakdownPanel breakdown={mockScore.breakdown} />);
        expect(screen.getByText("Developer Score")).toBeInTheDocument();
        expect(screen.getByText("Code Quality")).toBeInTheDocument();
    });

    it("hides GitHub section when not connected", () => {
        const noGithub = { ...mockScore.breakdown, github: null };
        render(<ScoreBreakdownPanel breakdown={noGithub} />);
        expect(screen.queryByText("Developer Score")).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// AttestationCard Component
// ---------------------------------------------------------------------------

describe("AttestationCard Component", () => {
    const mockAttestation = makeMockAttestation();

    it("renders proof hash", () => {
        render(<AttestationCard attestation={mockAttestation} />);
        expect(screen.getByText(mockAttestation.proof)).toBeInTheDocument();
    });

    it("renders verified attributes", () => {
        render(<AttestationCard attestation={mockAttestation} />);
        expect(screen.getByText("solana active")).toBeInTheDocument();
        expect(screen.getByText("github linked")).toBeInTheDocument();
    });

    it("has a copy proof button", () => {
        render(<AttestationCard attestation={mockAttestation} />);
        expect(screen.getByText("Copy Proof")).toBeInTheDocument();
    });

    it("renders ZK Attestation header", () => {
        render(<AttestationCard attestation={mockAttestation} />);
        expect(screen.getByText("ZK Attestation")).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// ShareScoreCard Component
// ---------------------------------------------------------------------------

describe("ShareScoreCard Component", () => {
    const mockScore = makeMockKiteScore();
    const mockAttestation = makeMockAttestation();

    it("renders Share Score button", () => {
        render(<ShareScoreCard score={mockScore} attestation={mockAttestation} />);
        expect(screen.getByText("Share Score")).toBeInTheDocument();
    });

    it("renders Kite Credit branding and mode label in card", () => {
        render(<ShareScoreCard score={mockScore} attestation={mockAttestation} />);
        expect(screen.getByText("Kite Credit")).toBeInTheDocument();
        expect(screen.getByText("Crypto Credit")).toBeInTheDocument();
    });

    it("renders attestation section with HMAC label when attestation provided", () => {
        render(<ShareScoreCard score={mockScore} attestation={mockAttestation} />);
        expect(screen.getByText("Verified Attestation")).toBeInTheDocument();
        expect(screen.getByText("HMAC-SHA256 signed")).toBeInTheDocument();
    });

    it("renders without crashing when attestation is null", () => {
        render(<ShareScoreCard score={mockScore} attestation={null} />);
        expect(screen.getByText("Share Score")).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// ErrorBoundary Component
// ---------------------------------------------------------------------------

describe("ErrorBoundary Component", () => {
    const ThrowingComponent = () => {
        throw new Error("Test explosion");
    };

    // Suppress console.error for expected errors
    const originalError = console.error;
    beforeAll(() => { console.error = jest.fn(); });
    afterAll(() => { console.error = originalError; });

    it("catches errors and renders fallback", () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByText("Test explosion")).toBeInTheDocument();
    });

    it("has a try again button", () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );
        expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("renders children when no error", () => {
        render(
            <ErrorBoundary>
                <div>Works fine</div>
            </ErrorBoundary>
        );
        expect(screen.getByText("Works fine")).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Reclaim/Financial Pipeline
// ---------------------------------------------------------------------------

describe("Financial Scoring Pipeline", () => {
    it("generates mock proof and scores correctly for high balance", () => {
        const proof = generateMockProof({ balance: 50000 });
        const score = scoreFinancial(proof);
        expect(score.score).toBe(440);
        expect(score.verified).toBe(true);
    });

    it("generates mock proof for low balance", () => {
        const proof = generateMockProof({ balance: 500 });
        const score = scoreFinancial(proof);
        expect(score.score).toBeLessThan(440);
        expect(score.verified).toBe(true);
    });

    it("gives 0 verification bonus for unverified data", () => {
        const score = scoreFinancial({
            verified: false,
            proofHash: "",
            balanceBracket: "under-1k",
            incomeConsistency: false,
            provider: "test",
        });
        expect(score.breakdown.verificationBonus).toBe(0);
        expect(score.verified).toBe(false);
        expect(score.score).toBeLessThan(100);
    });
});

