// ---------------------------------------------------------------------------
// GET /api/auth/github/callback
// ---------------------------------------------------------------------------
// Handles the OAuth callback from GitHub. Validates the CSRF state,
// exchanges the authorization code for an access token, and stores
// the token in an HTTP-only secure cookie (never in localStorage).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!code || !state) {
        return NextResponse.redirect(
            `${appUrl}/dashboard?error=missing_params`
        );
    }

    // Validate CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("github_oauth_state")?.value;

    if (!storedState || storedState !== state) {
        return NextResponse.redirect(
            `${appUrl}/dashboard?error=invalid_state`
        );
    }

    // Clear the state cookie
    cookieStore.delete("github_oauth_state");

    // Exchange code for access token
    try {
        const tokenResponse = await fetch(
            "https://github.com/login/oauth/access_token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    client_id: process.env.GITHUB_CLIENT_ID,
                    client_secret: process.env.GITHUB_CLIENT_SECRET,
                    code,
                    redirect_uri: `${appUrl}/api/auth/github/callback`,
                }),
            }
        );

        const tokenData = await tokenResponse.json();

        if (tokenData.error || !tokenData.access_token) {
            console.error("[github/callback] Token exchange failed:", tokenData.error);
            return NextResponse.redirect(
                `${appUrl}/dashboard?error=token_exchange_failed`
            );
        }

        // Store the access token in an HTTP-only secure cookie
        cookieStore.set("github_token", tokenData.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/",
        });

        return NextResponse.redirect(`${appUrl}/dashboard?github=connected`);
    } catch (err) {
        console.error("[github/callback] Error:", err);
        return NextResponse.redirect(
            `${appUrl}/dashboard?error=github_auth_failed`
        );
    }
}
