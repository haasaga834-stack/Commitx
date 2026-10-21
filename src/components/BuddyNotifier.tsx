import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buddyEventText, type BuddyEvent } from "@/lib/study-buddy";

/**
 * While CommitX is open, shows unseen Study Buddy updates (start, finish,
 * give-up, nudge) as a small banner, then marks them seen.
 */
export function BuddyNotifier({ userId, hidden }: { userId: string | null; hidden?: boolean }) {
  const [banner, setBanner] = useState<{ text: string; nudge: boolean } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const check = async () => {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        const { data } = await supabase
          .from("buddy_events")
          .select("id, event_type, goal, duration_minutes, coins, created_at, user_id")
          .eq("recipient_id", userId)
          .is("seen_at", null)
          .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
          .order("created_at", { ascending: false })
          .limit(5);
        const events = (data ?? []) as BuddyEvent[];
        if (!events.length) return;
        const latest = events[0];
        const { data: prof } = await supabase.rpc("my_study_buddy");
        const name = (Array.isArray(prof) && prof[0]?.display_name) || "Your buddy";
        const extra = events.length > 1 ? ` (+${events.length - 1} more)` : "";
        setBanner({ text: buddyEventText(name, latest) + extra, nudge: latest.event_type === "nudge" });
        await supabase.rpc("mark_buddy_events_seen");
      } finally {
        busy.current = false;
      }
    };
    void check();
    const t = window.setInterval(() => void check(), 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 9000);
    return () => window.clearTimeout(t);
  }, [banner]);

  if (!banner || hidden) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-hairline bg-card px-4 py-3 shadow-lift animate-fade-up">
        <p className="min-w-0 flex-1 text-sm text-foreground">{banner.text}</p>
        {banner.nudge && (
          <Link to="/commit" onClick={() => setBanner(null)} className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Start
          </Link>
        )}
        <button type="button" aria-label="Dismiss" onClick={() => setBanner(null)} className="shrink-0 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
