// ---------------------------------------------------------------------------
// GET /api/auth/github/callback
// ---------------------------------------------------------------------------
// Handles the OAuth callback from GitHub. Validates the CSRF state,
// exchanges the authorization code for an access token, stores it in
// an HTTP-only cookie AND persists to the database if user is logged in.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAppUrl } from "@/lib/env";
import { getUserFromToken, upsertConnection } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const appUrl = getAppUrl();

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

        // Persist to database if user is authenticated
        try {
            // Try to get user from the sb-access-token cookie
            const sbToken = cookieStore.get("sb-access-token")?.value;
            const user = await getUserFromToken(sbToken);

            if (user) {
                // Fetch GitHub username
                const ghUserRes = await fetch("https://api.github.com/user", {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                });
                const ghUserData = await ghUserRes.json();

                // Check if this GitHub account is already linked to a different user
                const { createServerSupabaseClient } = await import("@/lib/supabase");
                const supabase = createServerSupabaseClient();
                const { data: existingConn } = await supabase
                    .from("user_connections")
                    .select("user_id")
                    .eq("provider", "github")
                    .eq("provider_user_id", ghUserData.login)
                    .neq("user_id", user.id)
                    .limit(1);

                if (existingConn && existingConn.length > 0) {
                    return NextResponse.redirect(
                        `${appUrl}/dashboard?error=github_already_linked`
                    );
                }

                await upsertConnection(
                    user.id,
                    "github",
                    ghUserData.login || null,
                    tokenData.access_token,
                    { scope: tokenData.scope }
                );
            }
        } catch (dbError) {
            // Non-fatal: cookie already set, DB persistence is bonus
            console.error("[github/callback] DB persistence failed:", dbError);
        }

        return NextResponse.redirect(`${appUrl}/dashboard?github=connected`);
    } catch (err) {
        console.error("[github/callback] Error:", err);
        return NextResponse.redirect(
            `${appUrl}/dashboard?error=github_auth_failed`
        );
    }
}
