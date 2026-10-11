import { useEffect, useState } from "react";
import { fetchCommunityCxCoins, fetchLeaderboard } from "@/lib/community.functions";

export interface LeaderRow {
  userId: string;
  name: string;
  minutes: number;
  photo: string | null;
}

/** Fired whenever a finished session reaches the cloud, on any device. */
export const LEADERBOARD_REFRESH_EVENT = "commitx:leaderboard-refresh";

export function announceLeaderboardChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LEADERBOARD_REFRESH_EVENT));
}

/**
 * Subscribes a loader to every moment the standings could have moved:
 * a local session landing in the cloud, the app coming back to the
 * foreground, regaining connectivity, plus a slow safety poll for other
 * people's sessions.
 */
function useLiveRefresh(load: () => void, intervalMs = 25_000) {
  useEffect(() => {
    const run = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener(LEADERBOARD_REFRESH_EVENT, run);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(run, intervalMs);
    return () => {
      window.removeEventListener(LEADERBOARD_REFRESH_EVENT, run);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, intervalMs]);
}

/** Top study-hour totals across all users, straight from the cloud. */
export function useLeaderboard(limit = 10) {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useLiveRefresh(() => setTick((t) => t + 1));

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
            photo: r.avatar_url ?? null,
          })),
        );
      } catch {
        if (!alive) return;
      }
      setLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [limit, tick]);

  return { rows, loading };
}

/** Total Cx Coins earned by the whole community (1 per completed focus hour). */
export function useCommunityCxCoins() {
  const [coins, setCoins] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useLiveRefresh(() => setTick((t) => t + 1));

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
    return () => {
      alive = false;
    };
  }, [tick]);

  return { coins, loaded };
}

