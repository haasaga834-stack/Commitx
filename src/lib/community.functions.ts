import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LeaderRowDTO {
  user_id: string;
  display_name: string;
  total_minutes: number;
}

/** Top study-hour totals across all users (aggregate only, no PII beyond display name). */
export const fetchLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(50).default(10) }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<LeaderRowDTO[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("leaderboard_top", {
      _limit: data.limit,
    });
    if (error) throw new Error("Unable to load leaderboard");
    return (rows ?? []) as LeaderRowDTO[];
  });

/** Total Cx Coins earned by the whole community. */
export const fetchCommunityCxCoins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<number> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("community_food_coins");
    if (error) throw new Error("Unable to load community total");
    return Number(data) || 0;
  });
