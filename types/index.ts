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
    protocol: string; // e.g. "kamino", "marginfi", "drift"
    count: number;
    category: "lending" | "dex" | "nft" | "perps" | "staking"; // protocol category
  }[];
  stakingActive: boolean;
  stakingDurationDays: number;
  solBalance: number;
  stablecoinBalance: number; // USD-denominated sum of USDC + USDT holdings
  lstBalance: number;        // SOL-denominated sum of liquid staking tokens (jitoSOL, mSOL, bSOL)
  liquidationCount: number;  // Detected lending liquidation events (0 if none or undetectable)
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
    walletAge: number;          // 0-125
    deFiActivity: number;       // 0-165
    repaymentHistory: number;   // 0-125
    staking: number;            // 0-60
    stablecoinCapital: number;  // 0-25
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
// Signed Attestation
// ---------------------------------------------------------------------------
// The proof field is an HMAC-SHA256 signature over the score data.
// "ZK Attestation" is the product-facing name used in the UI.
// The bank verification step (Reclaim Protocol) uses actual ZK proofs;
// this attestation object is the final portable credential signed by Kite.
//
// Note: snake_case field names are intentional — they match the external
// attestation wire format. Internal code should use these fields as-is
// when serializing/deserializing attestations.
export interface SignedAttestation {
  kite_score: number;
  tier: ScoreTier;
  verified_attributes: string[]; // e.g. ["github_linked", "solana_active", "bank_verified"]
  proof: string;                 // HMAC-SHA256 hex string (0x-prefixed)
  issued_at: string;             // ISO 8601
  expires_at?: string;           // ISO 8601 — issued_at + 90 days (absent on legacy attestations)
  version: string;               // "1.0"
}

// ZKAttestation is kept as an alias so existing imports and DB-stored
// JSON objects continue to work without a migration.
export type ZKAttestation = SignedAttestation;

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Share page data (stored in shared_scores table)
// ---------------------------------------------------------------------------

export interface ShareData {
  cryptoScore: number;
  cryptoTier: ScoreTier;
  devScore: number | null;
  devTier: ScoreTier | null;
  devRaw: number | null;
  onChainScore: number;
  proof: string;
  attestationDate: string;
  expiresAt?: string;   // ISO 8601 — absent on legacy share links
  verifiedAttrs: string[];
}

// ---------------------------------------------------------------------------
// Lender Infrastructure
// ---------------------------------------------------------------------------

export interface LenderApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  name: string | null;
  email: string | null;
  use_case: string | null;
  rate_limit: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LenderWebhook {
  id: string;
  lender_id: string;
  wallet_address: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  error: string | null;
  delivered_at: string;
}

export interface BatchLookupResponse {
  results: Array<{
    address: string;
    found: boolean;
    score?: number;
    tier?: string;
    expired?: boolean;
    issued_at?: string | null;
    expires_at?: string | null;
  }>;
  lookup_count: number;
}

export interface WebhookPayload {
  event: string;
  wallet_address: string;
  score: number;
  tier: string;
  issued_at: string;
  timestamp: string;
}

export interface LenderDashboardData {
  id: string;
  name: string | null;
  email: string | null;
  key_prefix: string;
  rate_limit: number;
  active: boolean;
  created_at: string;
  total_webhooks: number;
  active_webhooks: number;
}
