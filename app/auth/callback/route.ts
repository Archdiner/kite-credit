// ---------------------------------------------------------------------------
// Supabase Auth Callback Handler
// ---------------------------------------------------------------------------
// Handles the PKCE code exchange for email confirmation links and OAuth
// redirects. Supabase sends a one-time `code` parameter that must be
// exchanged server-side for a session.
//
// This route is the redirect target for:
//   - Email verification  (Supabase dashboard > Auth > Email Templates)
//   - Password reset links (set redirectTo in resetPasswordForEmail)
//   - OAuth providers (if added in future)
//
// Set the following in your Supabase project:
//   Auth > URL Configuration > Site URL: https://kitecredit.xyz
//   Auth > URL Configuration > Redirect URLs: https://kitecredit.xyz/auth/callback
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";
    const type = searchParams.get("type");

    if (!code) {
        // No code — malformed or direct navigation to this URL
        return NextResponse.redirect(`${origin}/auth?error=missing_code`);
    }

    try {
        const supabase = createServerSupabaseClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error("[auth/callback] Code exchange failed:", error.message);
            return NextResponse.redirect(`${origin}/auth?error=invalid_code`);
        }

        // Password recovery: redirect to the reset password page
        if (type === "recovery") {
            return NextResponse.redirect(`${origin}/auth/reset-password`);
        }

        // Email confirmation: redirect to dashboard (or `next` param)
        return NextResponse.redirect(`${origin}${next}`);
    } catch (err) {
        console.error("[auth/callback] Unexpected error:", err);
        return NextResponse.redirect(`${origin}/auth?error=callback_failed`);
    }
}
