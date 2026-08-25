import { supabase } from "@/integrations/supabase/client";
import {
  getState,
  hydrateState,
  subscribe,
  type AppState,
  type Session,
} from "./commitx-store";
import { recordSessions } from "./wallet.functions";
import { isOnline, onReconnect, startConnectivityWatch } from "./connectivity";

const syncedKey = (userId: string) => `commitx-synced-session-ids-v1:${userId}`;

function readSyncedIds(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(syncedKey(userId));
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function writeSyncedIds(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(syncedKey(userId), JSON.stringify([...syncedSessionIds]));
  } catch {}
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
/** A local write happened while offline and still needs pushing. */
let pendingPush = false;
let stopReconnect: (() => void) | null = null;

/**
 * Pull at most once per burst. Realtime fires several events for a single
 * local write (wallet + session rows); without this the app used to run 3
 * queries per event and re-render the whole tree each time.
 */
function schedulePull(userId: string) {
  // Offline: the local store is already the source of truth, so skip the
  // round-trip entirely and let the reconnect hook catch up later.
  if (!isOnline()) return;
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
    coinsSpent: row.coins_spent,
    coinsEarned: row.coins_earned,
  };
}

/** Pull profile, wallet and sessions from the cloud into the local store. */
export async function pullFromCloud(userId: string) {
  if (!isOnline()) return null;
  const [profileRes, walletRes, sessionsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (profileRes.error || walletRes.error || sessionsRes.error) {
    throw profileRes.error ?? walletRes.error ?? sessionsRes.error;
  }

  const profile = profileRes.data;
  const wallet = walletRes.data;
  const sessions = sessionsRes.data;

  const rows = sessions ?? [];
  const remoteSessions = rows.map(toSession);
  const remoteIds = new Set(remoteSessions.map((s) => s.id));
  const localUnsynced = getState().sessions.filter((s) => !remoteIds.has(s.id) && !syncedSessionIds.has(s.id));
  syncedSessionIds = new Set([...remoteIds, ...syncedSessionIds]);
  if (currentUserId === userId) writeSyncedIds(userId);
  if (localUnsynced.length > 0) pendingPush = true;

  const next: AppState = {
    coins: wallet?.coin_balance ?? 0,
    sessions: [...localUnsynced, ...remoteSessions],
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
  if (!isOnline()) {
    pendingPush = true;
    return;
  }
  const state = getState();

  // Profile fields are user-owned preferences and stay a direct write.
  const { error: profileError } = await supabase
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
  if (profileError) throw profileError;

  // Balances and session rewards are recomputed server-side; the client only
  // reports what happened and then adopts the authoritative result.
  const unsynced = state.sessions.filter((s) => !syncedSessionIds.has(s.id));
  if (unsynced.length === 0) return;

  const result = await recordSessions({
    data: {
      sessions: unsynced.slice(0, 20).map((s) => ({
        ...(uuidRe.test(s.id) ? { id: s.id } : {}),
        goal: s.goal || "Focus",
        durationMinutes: Math.max(0, Math.round(s.durationMinutes)),
        value: Math.max(0, Math.round(s.value)),
        mode: s.mode,
        status: s.status,
      })),
    },
  });

  for (const s of unsynced.slice(0, 20)) syncedSessionIds.add(s.id);
  for (const id of result.ids) syncedSessionIds.add(id);
  writeSyncedIds(userId);

  applyingRemote = true;
  hydrateState({
    ...getState(),
    coins: result.coins,
  });
  applyingRemote = false;
}

let channel: ReturnType<typeof supabase.channel> | null = null;

/** Start mirroring local store changes to the cloud for this user. */
export function startCloudSync(userId: string) {
  stopCloudSync();
  startConnectivityWatch();
  currentUserId = userId;
  syncedSessionIds = readSyncedIds(userId);
  if (!stopReconnect) {
    stopReconnect = onReconnect(() => {
      const uid = currentUserId;
      if (!uid) return;
      // Push first (dedup guarded), then pull the authoritative result.
      if (pendingPush) {
        pendingPush = false;
        lastPushAt = Date.now();
        void push(uid)
          .catch(() => {
            pendingPush = true;
          })
          .finally(() => {
            lastPushAt = Date.now();
            schedulePull(uid);
          });
      } else {
        void pullFromCloud(uid)
          .then(() => {
            if (!pendingPush) return;
            pendingPush = false;
            lastPushAt = Date.now();
            return push(uid);
          })
          .catch(() => {
            pendingPush = true;
          })
          .finally(() => {
            lastPushAt = Date.now();
          });
      }
    });
  }
  unsubscribe = subscribe(() => {
    if (applyingRemote || !currentUserId) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (!isOnline()) {
        // Nothing is lost: unsynced sessions stay unsynced (and de-duplicated
        // by `syncedSessionIds`) until connectivity returns.
        pendingPush = true;
        return;
      }
      lastPushAt = Date.now();
      void push(currentUserId!)
        .catch(() => {
          pendingPush = true;
        })
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
  pendingPush = false;
  lastPushAt = 0;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
