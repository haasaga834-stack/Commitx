import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderRow {
  userId: string;
  name: string;
  minutes: number;
}

/** Top study-hour totals across all users, straight from the cloud. */
export function useLeaderboard(limit = 10) {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("leaderboard_top", { _limit: limit });
      if (!alive) return;
      setRows(
        (data ?? []).map((r) => ({
          userId: r.user_id,
          name: r.display_name,
          minutes: Number(r.total_minutes) || 0,
        })),
      );
      setLoading(false);
    };
    void load();

    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [limit]);

  return { rows, loading };
}

/** Total Food Coins earned by the whole community (1 per completed focus hour). */
export function useCommunityFoodCoins() {
  const [coins, setCoins] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("community_food_coins");
      if (!alive) return;
      setCoins(Number(data) || 0);
      setLoaded(true);
    };
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return { coins, loaded };
}
