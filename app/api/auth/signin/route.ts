// ---------------------------------------------------------------------------
// POST /api/auth/signin
// ---------------------------------------------------------------------------
// Signs in a user with email and password.
// Returns specific error messages: "User not found" vs "Invalid password".
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return errorResponse("Email and password are required", 400);
        }

        // Use publishable key for sign-in (server-side, so both env vars available)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !publishableKey) {
            return errorResponse("Server configuration error", 500);
        }

        const supabase = createClient(supabaseUrl, publishableKey);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("[auth/signin] Sign in error:", error.message);

            // Use admin client to check if user exists for better error messages
            try {
                const adminSupabase = createServerSupabaseClient();
                const { data: { users } } = await adminSupabase.auth.admin.listUsers({
                    page: 1,
                    perPage: 1000,
                });
                const userExists = users.find(
                    (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
                );

                if (!userExists) {
                    return errorResponse("User not found. Please sign up first.", 404);
                } else {
                    return errorResponse("Incorrect password. Please try again.", 401);
                }
            } catch (adminError) {
                console.error("[auth/signin] Admin check failed:", adminError);
            }

            return errorResponse("Invalid email or password", 401);
        }

        if (!data.session) {
            return errorResponse("Failed to create session", 500);
        }

        return successResponse({
            user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.display_name || "",
            },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        });
    } catch (error) {
        console.error("[auth/signin] Unexpected error:", error);
        return errorResponse("Failed to sign in", 500);
    }
}
