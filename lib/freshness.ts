// ---------------------------------------------------------------------------
// Score freshness utilities
// ---------------------------------------------------------------------------
// Derives human-readable age and status from a score timestamp.
// 90-day expiry window matches mortgage underwriting freshness standards.

export interface ScoreAge {
    /** Human-readable label: "Just now" | "Xh ago" | "Xd ago" */
    label: string;
    /** fresh = < 24 h · aging = 1–7 d · stale = > 7 d */
    status: "fresh" | "aging" | "stale";
    /** Days remaining before the 90-day expiry (0 once expired) */
    daysUntilExpiry: number;
}

const EXPIRY_DAYS = 90;

export function getScoreAge(timestamp: string): ScoreAge {
    const ms = Date.now() - new Date(timestamp).getTime();
    const hours = ms / (1000 * 60 * 60);

    const expiryMs = new Date(timestamp).getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const daysUntilExpiry = Math.max(
        0,
        Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24))
    );

    let label: string;
    if (hours < 1) label = "Just now";
    else if (hours < 24) label = `${Math.floor(hours)}h ago`;
    else label = `${Math.floor(hours / 24)}d ago`;

    const status: ScoreAge["status"] =
        hours < 24 ? "fresh" : hours < 168 ? "aging" : "stale";

    return { label, status, daysUntilExpiry };
}
