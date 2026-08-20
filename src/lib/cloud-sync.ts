import { supabase } from "@/integrations/supabase/client";
import {
  getState,
  hydrateState,
  subscribe,
  type AppState,
  type Session,
} from "./commitx-store";

let syncedSessionIds = new Set<string>();
let applyingRemote = false;
let unsubscribe: (() => void) | null = null;
let currentUserId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
/** Timestamp of the last local write we pushed — used to ignore our own echo. */
let lastPushAt = 0;
/** Coalesce concurrent pulls: one network round-trip at a time. */
let pullInFlight: Promise<unknown> | null = null;
let pullQueued = false;

/**
 * Pull at most once per burst. Realtime fires several events for a single
 * local write (wallet + session rows); without this the app used to run 3
 * queries per event and re-render the whole tree each time.
 */
function schedulePull(userId: string) {
  if (pullInFlight) {
    pullQueued = true;
    return;
  }
  pullInFlight = pullFromCloud(userId)
    .catch(() => {})
    .finally(() => {
      pullInFlight = null;
      if (pullQueued) {
        pullQueued = false;
        if (currentUserId) schedulePull(currentUserId);
      }
    });
}

/** True while a realtime event is most likely the echo of our own write. */
function isOwnEcho() {
  return Date.now() - lastPushAt < 4000;
}

function toSession(row: any): Session {
  return {
    id: row.id,
    goal: row.goal,
    durationMinutes: row.duration_minutes,
    value: row.value,
    mode: row.mode,
    status: row.status,
    date: new Date(row.created_at).getTime(),
    demoUsed: row.demo_used,
    realUsed: row.real_used,
  };
}

/** Pull profile, wallet and sessions from the cloud into the local store. */
export async function pullFromCloud(userId: string) {
  const [{ data: profile }, { data: wallet }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const rows = sessions ?? [];
  syncedSessionIds = new Set(rows.map((r: any) => r.id));

  const next: AppState = {
    balances: {
      real: wallet?.real_balance ?? 0,
      demo: wallet?.demo_balance ?? 0,
    },
    sessions: rows.map(toSession),
    profile: {
      name: profile?.display_name ?? "New User",
      age: profile?.age ?? "",
      sex: profile?.sex ?? "",
      education: profile?.education ?? "",
      photo: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? "",

    },
    referralCredited: Boolean(profile?.referred_by),
    notificationsEnabled:
      (profile as { notifications_enabled?: boolean | null } | null)
        ?.notifications_enabled ?? true,
  };

  applyingRemote = true;
  hydrateState(next);
  applyingRemote = false;

  return profile;
}

async function push(userId: string) {
  const state = getState();

  // Profile fields are user-owned preferences and stay a direct write.
  await supabase
    .from("profiles")
    .update({
      display_name: state.profile.name,
      age: state.profile.age,
      sex: state.profile.sex,
      education: state.profile.education,
      avatar_url: state.profile.photo || null,
      notifications_enabled: state.notificationsEnabled ?? true,
    })
    .eq("id", userId);

  // Balances and session rewards are recomputed server-side; the client only
  // reports what happened and then adopts the authoritative result.
  const unsynced = state.sessions.filter((s) => !syncedSessionIds.has(s.id));
  if (unsynced.length === 0) return;
  for (const s of unsynced) syncedSessionIds.add(s.id);

  const result = await recordSessions({
    data: {
      sessions: unsynced.slice(0, 20).map((s) => ({
        goal: s.goal || "Focus",
        durationMinutes: Math.max(0, Math.round(s.durationMinutes)),
        value: Math.max(0, Math.round(s.value)),
        mode: s.mode,
        status: s.status,
      })),
    },
  });

  for (const id of result.ids) syncedSessionIds.add(id);

  applyingRemote = true;
  hydrateState({
    ...getState(),
    balances: { real: result.real, demo: result.demo },
  });
  applyingRemote = false;
}

let channel: ReturnType<typeof supabase.channel> | null = null;

/** Start mirroring local store changes to the cloud for this user. */
export function startCloudSync(userId: string) {
  stopCloudSync();
  currentUserId = userId;
  unsubscribe = subscribe(() => {
    if (applyingRemote || !currentUserId) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      lastPushAt = Date.now();
      void push(currentUserId!)
        .catch(() => {})
        .finally(() => {
          lastPushAt = Date.now();
        });
    }, 400);
  });

  // Keep other devices in step: any cloud change to this user's rows re-pulls.
  channel = supabase
    .channel(`commitx-user-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
      () => {
        if (currentUserId && !isOwnEcho()) schedulePull(currentUserId);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "focus_sessions", filter: `user_id=eq.${userId}` },
      () => {
        if (currentUserId && !isOwnEcho()) schedulePull(currentUserId);
      },
    )
    .subscribe();
}

export function stopCloudSync() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  currentUserId = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  syncedSessionIds = new Set();
  pullQueued = false;
  lastPushAt = 0;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
