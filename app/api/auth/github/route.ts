// ---------------------------------------------------------------------------
// GET /api/auth/github
// ---------------------------------------------------------------------------
// Initiates the GitHub OAuth flow. Redirects the user to GitHub's
// authorization page with appropriate scopes and CSRF state parameter.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!clientId) {
        return NextResponse.json(
            { success: false, error: "GitHub OAuth not configured." },
            { status: 500 }
        );
    }

    // Generate CSRF state token and store in cookie
    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("github_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
        path: "/",
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${appUrl}/api/auth/github/callback`,
        scope: "read:user repo",
        state,
    });

    return NextResponse.redirect(
        `https://github.com/login/oauth/authorize?${params.toString()}`
    );
}
