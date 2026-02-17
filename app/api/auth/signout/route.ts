// ---------------------------------------------------------------------------
// POST /api/auth/signout
// ---------------------------------------------------------------------------
// Signs out the current user by invalidating their session.
// ---------------------------------------------------------------------------

import { successResponse } from "@/lib/api-utils";

export async function POST() {
    // Client-side handles clearing the token from localStorage.
    // Server-side just acknowledges the signout.
    return successResponse({ message: "Signed out" });
}
