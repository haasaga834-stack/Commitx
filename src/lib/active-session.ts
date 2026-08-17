import { supabase } from "@/integrations/supabase/client";

/**
 * Server-side single-session guard. One row per user in `active_sessions`
 * (user_id is the primary key), so a second concurrent session — from a
 * double-tap, a refresh, a retry or another device — cannot be created.
 */
export interface ActiveDbSession {
  user_id: string;
  goal: string;
  duration_minutes: number;
  value: number;
  mode: string;
  started_at: string;
}

async function currentUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** Rows older than the committed duration + 4h are abandoned leftovers. */
function isStale(row: ActiveDbSession) {
  const started = new Date(row.started_at).getTime();
  if (!Number.isFinite(started)) return true;
  return Date.now() - started > row.duration_minutes * 60_000 + 4 * 60 * 60_000;
}

/** Returns the live active session for this user, cleaning up stale rows. */
export async function getActiveDbSession(): Promise<ActiveDbSession | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from("active_sessions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const row = (data as ActiveDbSession | null) ?? null;
  if (!row) return null;
  if (isStale(row)) {
    await releaseActiveDbSession();
    return null;
  }
  return row;
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "exists"; existing: ActiveDbSession | null };

/** Atomically claims the user's single session slot before a timer starts. */
export async function claimActiveDbSession(input: {
  goal: string;
  duration: number;
  value: number;
  mode: string;
}): Promise<ClaimResult> {
  const userId = await currentUserId();
  // Signed out / offline: local guards still apply.
  if (!userId) return { ok: true };

  const existing = await getActiveDbSession();
  if (existing) return { ok: false, reason: "exists", existing };

  const { error } = await supabase.from("active_sessions").insert({
    user_id: userId,
    goal: input.goal,
    duration_minutes: input.duration,
    value: input.value,
    mode: input.mode,
    started_at: new Date().toISOString(),
  });

  if (error) {
    // Unique violation === another session was claimed a moment ago.
    if (error.code === "23505") {
      return { ok: false, reason: "exists", existing: await getActiveDbSession() };
    }
    // Any other failure (offline, RLS) must not block the user's focus time.
    return { ok: true };
  }
  return { ok: true };
}

/** Frees the slot — called whenever a session ends (completed or failed). */
export async function releaseActiveDbSession() {
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await supabase.from("active_sessions").delete().eq("user_id", userId);
  } catch {}
}
