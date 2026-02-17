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
}

export interface OnChainScore {
  score: number; // 0-400
  breakdown: {
    walletAge: number;       // 0-100
    deFiActivity: number;    // 0-150
    repaymentHistory: number; // 0-100
    staking: number;         // 0-50
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
  commitsLastYear: number;
  longestRepoAgeDays: number;
  contributionStreak: number; // consecutive weeks with commits
}

export interface GitHubScore {
  score: number; // 0-300
  breakdown: {
    accountAge: number;        // 0-50
    repoPortfolio: number;     // 0-75
    commitConsistency: number; // 0-100
    communityTrust: number;    // 0-75
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
  score: number; // 0-300
  breakdown: {
    balanceHealth: number;       // 0-150
    incomeConsistency: number;   // 0-100
    verificationBonus: number;   // 0-50
  };
}

// ---------------------------------------------------------------------------
// Combined Kite Score
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  onChain: OnChainScore | null;
  github: GitHubScore | null;
  financial: FinancialScore | null;
}

export interface KiteScore {
  total: number;        // 0-1000
  tier: ScoreTier;
  breakdown: ScoreBreakdown;
  explanation: string;  // Gemini-generated plain-language summary
  timestamp: string;    // ISO 8601
}

// ---------------------------------------------------------------------------
// ZK Attestation
// ---------------------------------------------------------------------------

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
