import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { ShareData } from "@/types";

export const getShareData = cache(async (id: string): Promise<ShareData | null> => {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
        .from("shared_scores")
        .select("data")
        .eq("id", id)
        .single();

    if (error || !data) return null;
    return data.data as ShareData;
});
