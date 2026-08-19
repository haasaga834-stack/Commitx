import { useEffect, useState } from "react";
import { fetchCommunityCxCoins, fetchLeaderboard } from "@/lib/community.functions";

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
      try {
        const data = await fetchLeaderboard({ data: { limit } });
        if (!alive) return;
        setRows(
          (data ?? []).map((r) => ({
            userId: r.user_id,
            name: r.display_name,
            minutes: Number(r.total_minutes) || 0,
          })),
        );
      } catch {
        if (!alive) return;
      }
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

/** Total Cx Coins earned by the whole community (1 per completed focus hour). */
export function useCommunityCxCoins() {
  const [coins, setCoins] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const value = await fetchCommunityCxCoins();
        if (!alive) return;
        setCoins(value);
      } catch {
        if (!alive) return;
      }
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

