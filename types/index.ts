// ---------------------------------------------------------------------------
// Kite Credit -- Shared Types
// ---------------------------------------------------------------------------

// Score tiers mapped to human-readable labels
export type ScoreTier = "Building" | "Steady" | "Strong" | "Elite";

// ---------------------------------------------------------------------------
// On-Chain (Solana) data
// ---------------------------------------------------------------------------

export interface OnChainData {
  walletAddress: string;
  walletAgeDays: number;
  totalTransactions: number;
  deFiInteractions: {
    protocol: string; // e.g. "kamino", "solend"
    count: number;
  }[];
  stakingActive: boolean;
  stakingDurationDays: number;
  solBalance: number;
}

// ---------------------------------------------------------------------------
// FICO-Inspired 5-Factor Score Breakdown (v3)
// ---------------------------------------------------------------------------

export interface FiveFactorBreakdown {
  paymentHistory: {
    score: number; // 0-350 (35%)
    details: {
      onChainRepayments: number;
      bankBillPay: number;
    };
  };
  utilization: {
    score: number; // 0-300 (30%) - Adjusted from FICO 30% to fit our 1000 scale
    details: {
      creditUtilization: number;
      collateralHealth: number;
      balanceRatio: number;
    };
  };
  creditAge: {
    score: number; // 0-150 (15%)
    details: {
      walletAge: number;
      accountAge: number;
    };
  };
  creditMix: {
    score: number; // 0-100 (10%)
    details: {
      protocolDiversity: number;
      accountDiversity: number;
    };
  };
  newCredit: {
    score: number; // 0-100 (10%)
    details: {
      recentInquiries: number;
      recentOpenings: number;
    };
  };
}

export interface OnChainScore {
  score: number; // 0-500
  breakdown: {
    walletAge: number;       // 0-125
    deFiActivity: number;    // 0-190
    repaymentHistory: number; // 0-125
    staking: number;         // 0-60
  };
}

// ---------------------------------------------------------------------------
// GitHub (Professional) data
// ---------------------------------------------------------------------------

export interface GitHubData {
  username: string;
  accountAgeDays: number;
  publicRepos: number;
  totalStars: number;
  followers: number;
  recentCommitCount: number;
  longestRepoAgeDays: number;
  recentActiveWeeks: number;
  languageDiversity: number;
  ownerReputation: number;
  originalityScore: number;
  // Code quality proxy signals
  reposWithReadme: number;
  reposWithCI: number;
  totalPRsMerged: number;
  totalIssuesClosed: number;
  codeReviewCount: number;
  avgRepoSize: number;       // KB — proxy for non-trivial projects
  topRepoTestIndicator: number; // 0-1 fraction of top repos with test dirs/configs
}

export interface GitHubScore {
  score: number; // 0-300
  breakdown: {
    accountAge: number;        // 0-40
    repoPortfolio: number;     // 0-60
    commitConsistency: number; // 0-70
    communityTrust: number;    // 0-50
    codeQuality: number;       // 0-80 — the new quality dimension
  };
}

// ---------------------------------------------------------------------------
// Financial (ZK-verified) data
// ---------------------------------------------------------------------------

export interface FinancialData {
  verified: boolean;
  proofHash: string;
  balanceBracket: string; // e.g. "1k-5k", "5k-25k", "25k-100k", "100k+"
  incomeConsistency: boolean;
  provider: string; // e.g. "chase", "bofa"
}

export interface FinancialScore {
  score: number; // 0-500
  breakdown: {
    balanceHealth: number;       // 0-250
    incomeConsistency: number;   // 0-165
    verificationBonus: number;   // 0-85
  };
  verified: boolean;
}


// ---------------------------------------------------------------------------
// Combined Kite Score
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  onChain: OnChainScore;
  github: GitHubScore | null;
  financial: FinancialScore | null;
  fiveFactor: FiveFactorBreakdown; // New verified breakdown
}

export interface KiteScore {
  total: number;        // 0-1000
  tier: ScoreTier;
  breakdown: ScoreBreakdown;
  githubBonus: number;  // 0-50
  explanation: string;  // Gemini-generated plain-language summary
  weights?: {           // Dynamic weights applied
    onChain: number;
    financial: number;
  };
  timestamp: string;    // ISO 8601
}

// ---------------------------------------------------------------------------
// ZK Attestation
// ---------------------------------------------------------------------------

// Note: snake_case field names are intentional here — they match the external
// ZK attestation protocol wire format. Internal code should use these fields
// as-is when serializing/deserializing attestations.
export interface ZKAttestation {
  kite_score: number;
  tier: ScoreTier;
  verified_attributes: string[]; // e.g. ["github_linked", "solana_active", "bank_verified"]
  proof: string;                 // ZK proof hex string
  issued_at: string;             // ISO 8601
  version: string;               // "1.0"
}

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
