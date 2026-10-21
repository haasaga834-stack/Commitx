import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BuddyStatus {
  buddyId: string | null;
  name: string | null;
  avatarUrl: string | null;
  focusing: boolean;
  goal: string | null;
  endsAt: number | null;
  todayMinutes: number;
  pendingCode: string | null;
}

export interface BuddyEvent {
  id: string;
  event_type: "started" | "completed" | "failed" | "nudge";
  goal: string;
  duration_minutes: number;
  coins: number;
  created_at: string;
  user_id: string;
}

export function buddyInviteUrl(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://commitx.site";
  return `${origin}/buddy/${code}`;
}

/** Plain-language line shown to the buddy for each event. */
export function buddyEventText(name: string, e: Pick<BuddyEvent, "event_type" | "goal" | "duration_minutes" | "coins">) {
  const first = name.split(" ")[0] || "Your buddy";
  const goal = e.goal ? ` ${e.goal}` : "";
  switch (e.event_type) {
    case "started":
      return `${first} started a ${e.duration_minutes}m${goal} session.`;
    case "completed":
      return `🔥 ${first} completed their ${e.duration_minutes}m session${e.coins > 0 ? ` (+${e.coins} Cx Coins)` : ""}!`;
    case "failed":
      return `👀 ${first} gave up on their ${e.duration_minutes}m${goal} session.`;
    case "nudge":
      return `${first} is nudging you to study. Start a session together?`;
  }
}

function friendlyError(e: unknown, fallback: string) {
  const msg = (e as { message?: string } | null)?.message;
  return msg && msg.length < 120 ? msg : fallback;
}

export function useStudyBuddy(enabled: boolean) {
  const [status, setStatus] = useState<BuddyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    const { data, error: err } = await supabase.rpc("my_study_buddy");
    if (err) return;
    const row = Array.isArray(data) ? data[0] : null;
    setStatus(
      row
        ? {
            buddyId: row.buddy_id,
            name: row.display_name,
            avatarUrl: row.avatar_url,
            focusing: Boolean(row.focusing),
            goal: row.goal,
            endsAt: row.ends_at ? Date.parse(row.ends_at) : null,
            todayMinutes: Number(row.today_minutes ?? 0),
            pendingCode: row.pending_code,
          }
        : { buddyId: null, name: null, avatarUrl: null, focusing: false, goal: null, endsAt: null, todayMinutes: 0, pendingCode: null },
    );
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [enabled, load]);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, fallback: string) => {
    setError(null);
    const { error: err } = await fn();
    if (err) {
      setError(friendlyError(err, fallback));
      return false;
    }
    await load();
    return true;
  };

  return {
    status,
    error,
    reload: load,
    createInvite: () => run(() => supabase.rpc("create_buddy_invite"), "Could not create an invite."),
    acceptCode: (code: string) => run(() => supabase.rpc("accept_buddy_invite", { _code: code }), "Could not use that code."),
    nudge: () => run(() => supabase.rpc("nudge_study_buddy"), "Could not send the nudge."),
    remove: () => run(() => supabase.rpc("remove_study_buddy"), "Could not remove your buddy."),
  };
}
