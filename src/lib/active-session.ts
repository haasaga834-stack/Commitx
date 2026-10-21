import { supabase } from "@/integrations/supabase/client";
import { isOnline } from "./connectivity";
import { hasNativeBridge } from "./native-session";

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
  status?: string | null;
  failure_reason?: string | null;
  platform?: string | null;
  last_heartbeat?: string | null;
}


async function currentUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * A row only represents a genuinely running session while its own window is
 * still open. 30 minutes of slack covers recovery breaks; anything past that is
 * an abandoned leftover (app killed, crash, forced close) and must never block
 * a new commitment.
 */
const END_GRACE_MS = 2 * 60_000;
const PAUSE_HEARTBEAT_MS = 2 * 60_000;

function isStale(row: ActiveDbSession) {
  const started = new Date(row.started_at).getTime();
  if (!Number.isFinite(started)) return true;
  // Still inside its planned window: genuinely running.
  if (Date.now() - started <= row.duration_minutes * 60_000 + END_GRACE_MS) return false;
  // Past its end: only a very recent check-in (a paused/extended session) keeps it.
  const heartbeat = row.last_heartbeat ? new Date(row.last_heartbeat).getTime() : Number.NaN;
  if (Number.isFinite(heartbeat) && Date.now() - heartbeat <= PAUSE_HEARTBEAT_MS) return false;
  return true;
}

/** Returns the live active session for this user, cleaning up stale rows. */
export async function getActiveDbSession(): Promise<ActiveDbSession | null> {
  if (!isOnline()) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("active_sessions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not check the active commitment. Please retry.");
  const row = (data as ActiveDbSession | null) ?? null;
  if (!row) return null;
  // A failed row (web heartbeat timeout, lifecycle failure) is dead: it must
  // never block a new commitment.
  if (row.status === "failed" || isStale(row)) {
    await releaseActiveDbSession(row);
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
  if (!isOnline()) return { ok: true };
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
    status: "active",
    // last_heartbeat is seeded by the server clock (column default) — a skewed
    // device clock must never look like a missed check-in.
    failure_reason: null,
    platform: hasNativeBridge() ? "native" : "web",
  });


  if (error) {
    // Unique violation === another session was claimed a moment ago.
    if (error.code === "23505") {
      return { ok: false, reason: "exists", existing: await getActiveDbSession() };
    }
    // Never start a supposedly saveable session without its durable claim.
    throw new Error("Could not save the commitment. Please retry when connected.");
  }
  track("session_started", { mode: input.mode, duration_bucket: durationBucket(input.duration) });
  return { ok: true };
}

/** Frees the slot — called whenever a session ends (completed or failed). */
export async function releaseActiveDbSession(claim?: ActiveDbSession) {
  if (!isOnline()) return;
  const userId = claim?.user_id ?? await currentUserId();
  if (!userId) return;
  try {
    const target = claim ?? (await supabase.from("active_sessions").select("*").eq("user_id", userId).maybeSingle()).data;
    if (!target?.started_at) return;
    await supabase.from("active_sessions").delete().eq("user_id", userId).eq("started_at", target.started_at);
  } catch {}
}
