// ---------------------------------------------------------------------------
// Health check endpoint
// ---------------------------------------------------------------------------
// GET /api/health
// Returns basic service status. Used to verify the API layer is working
// and security headers are being applied.
// ---------------------------------------------------------------------------

import { successResponse } from "@/lib/api-utils";

export async function GET() {
    return successResponse({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "0.1.0",
    });
}
