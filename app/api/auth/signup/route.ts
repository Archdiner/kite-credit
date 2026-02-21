// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------
// Creates a new user with email, password, and display name.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
    try {
        const { email, password, name } = await req.json();

        if (!email || !password || !name) {
            return errorResponse("Email, password, and name are required", 400);
        }

        if (password.length < 8) {
            return errorResponse("Password must be at least 8 characters", 400);
        }

        const supabase = createServerSupabaseClient();

        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for hackathon
            user_metadata: { display_name: name },
        });

        if (error) {
            if (error.message.includes("already")) {
                return errorResponse("An account with this email already exists", 409);
            }
            console.error("[auth/signup] Error:", error);
            return errorResponse(error.message, 400);
        }

        // Sign in immediately after signup
        const { createClient } = await import("@supabase/supabase-js");
        const anonClient = createClient(
            (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!,
            (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)!
        );

        const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError || !signInData.session) {
            // User was created but auto-signin failed — still success
            return successResponse({
                user: { id: data.user.id, email: data.user.email },
                session: null,
                message: "Account created. Please sign in.",
            }, 201);
        }

        return successResponse({
            user: {
                id: data.user.id,
                email: data.user.email,
                name,
            },
            session: {
                access_token: signInData.session.access_token,
                refresh_token: signInData.session.refresh_token,
                expires_at: signInData.session.expires_at,
            },
        }, 201);
    } catch (error) {
        console.error("[auth/signup] Unexpected error:", error);
        return errorResponse("Failed to create account", 500);
    }
}
