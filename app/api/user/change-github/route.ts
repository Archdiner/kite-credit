import { NextRequest } from "next/server";
import { getUserFromToken, extractAccessToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);
        if (!user) return errorResponse("Unauthorized", 401);

        const supabase = createServerSupabaseClient();

        await supabase
            .from("user_connections")
            .delete()
            .eq("user_id", user.id)
            .eq("provider", "github");

        return successResponse({ message: "GitHub disconnected. You can now connect a different account." });
    } catch (error) {
        console.error("[user/change-github] POST error:", error);
        return errorResponse("Failed to disconnect GitHub", 500);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const token = extractAccessToken(request);
        const user = await getUserFromToken(token);
        if (!user) return errorResponse("Unauthorized", 401);

        const { githubUsername } = await request.json();

        if (!githubUsername || typeof githubUsername !== "string") {
            return errorResponse("Missing GitHub username", 400);
        }

        const supabase = createServerSupabaseClient();
        const { data: existingConnections } = await supabase
            .from("user_connections")
            .select("user_id, provider_user_id")
            .eq("provider", "github")
            .eq("provider_user_id", githubUsername)
            .neq("user_id", user.id);

        if (existingConnections && existingConnections.length > 0) {
            return errorResponse("This GitHub account is already connected to another user.", 409);
        }

        return successResponse({ message: "GitHub username is available" });
    } catch (error) {
        console.error("[user/change-github] PUT error:", error);
        return errorResponse("Failed to check GitHub availability", 500);
    }
}
