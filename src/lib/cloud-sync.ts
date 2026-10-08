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
import { announceLeaderboardChange } from "./community";
import { hasLiveSession } from "./session-guard";

const syncedKey = (userId: string) => `commitx-synced-session-ids-v1:${userId}`;
const pendingKey = (userId: string) => `commitx-cloud-pending-v1:${userId}`;

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

function readPendingPush(userId: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(pendingKey(userId)) === "1";
  } catch {
    return false;
  }
}

function setPendingPush(value: boolean, userId = currentUserId) {
  pendingPush = value;
  if (typeof window === "undefined" || !userId) return;
  try {
    if (value) window.localStorage.setItem(pendingKey(userId), "1");
    else window.localStorage.removeItem(pendingKey(userId));
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

function sessionSignature(s: Session) {
  return [s.goal, s.durationMinutes, s.value, s.mode, s.status].join("|");
}

/** Pull profile, wallet and sessions from the cloud into the local store. */
export async function pullFromCloud(userId: string) {
  if (!isOnline()) return null;
  if (!(await hasLiveSession(userId))) return null;
  const localState = getState();
  const [profileRes, walletRes, sessionsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000),
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
  const remoteSignatures = new Map<string, number>();
  for (const session of remoteSessions) {
    const sig = sessionSignature(session);
    remoteSignatures.set(sig, (remoteSignatures.get(sig) ?? 0) + 1);
  }
  const localUnsynced = localState.sessions.filter((s) => {
    if (remoteIds.has(s.id) || syncedSessionIds.has(s.id)) return false;
    const sig = sessionSignature(s);
    const matchingRemoteCount = remoteSignatures.get(sig) ?? 0;
    if (matchingRemoteCount > 0) {
      remoteSignatures.set(sig, matchingRemoteCount - 1);
      syncedSessionIds.add(s.id);
      return false;
    }
    return true;
  });
  // Detect durable local writes before choosing the wallet balance. On a fresh
  // app process the in-memory flag may be false even though offline sessions
  // are still waiting in localStorage.
  const keepLocalChanges = pendingPush || localUnsynced.length > 0;
  syncedSessionIds = new Set([...remoteIds, ...syncedSessionIds]);
  if (currentUserId === userId) writeSyncedIds(userId);
  if (localUnsynced.length > 0) setPendingPush(true, userId);

  const next: AppState = {
    coins: keepLocalChanges ? localState.coins : (wallet?.coin_balance ?? localState.coins),
    sessions: [...localUnsynced, ...remoteSessions],
    profile: {
      name: keepLocalChanges ? localState.profile.name : (profile?.display_name ?? localState.profile.name),
      age: keepLocalChanges ? localState.profile.age : (profile?.age ?? localState.profile.age),
      sex: keepLocalChanges ? localState.profile.sex : (profile?.sex ?? localState.profile.sex),
      education: keepLocalChanges
        ? localState.profile.education
        : (profile?.education ?? localState.profile.education),
      photo: keepLocalChanges
        ? localState.profile.photo
        : ((profile as { avatar_url?: string | null } | null)?.avatar_url ?? localState.profile.photo),

    },
    referralCredited: keepLocalChanges
      ? localState.referralCredited
      : Boolean(profile?.referred_by ?? localState.referralCredited),
    notificationsEnabled:
      keepLocalChanges
        ? localState.notificationsEnabled
        :
      (profile as { notifications_enabled?: boolean | null } | null)
        ?.notifications_enabled ?? localState.notificationsEnabled ?? true,
  };

  applyingRemote = true;
  hydrateState(next);
  applyingRemote = false;

  // A startup pull can be the first moment an interrupted offline write is
  // discovered. Flush it without waiting for an unrelated store mutation.
  if (keepLocalChanges && currentUserId === userId) schedulePush(userId);

  return profile;
}

async function push(userId: string) {
  if (!isOnline() || !(await hasLiveSession(userId))) {
    setPendingPush(true, userId);
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
  // Oldest first, so each outcome is matched to the session claim it ended.
  for (let batch = 0; batch < 10; batch++) {
    const unsynced = getState()
      .sessions.filter((s) => !syncedSessionIds.has(s.id))
      .reverse()
      .slice(0, 20);
    if (unsynced.length === 0) break;

    const result = await recordSessions({
      data: {
        sessions: unsynced.map((s) => ({
          ...(uuidRe.test(s.id) ? { id: s.id } : {}),
          goal: (s.goal || "Focus").slice(0, 80),
          durationMinutes: Math.min(720, Math.max(0, Math.round(s.durationMinutes))),
          value: Math.min(500, Math.max(0, Math.round(s.value))),
          mode: s.mode,
          status: s.status,
          ...(Number.isFinite(s.date) && s.date > 0 ? { endedAt: Math.round(s.date) } : {}),
        })),
      },
    });

    // Only the server's answer decides. Accepted sessions are now part of the
    // shared history; refused ones (no genuine claim, unfinished, already
    // settled) are removed so no screen keeps counting time or coins for them.
    const refused = new Set<string>(result.rejected);
    for (const s of unsynced) if (!uuidRe.test(s.id)) refused.add(s.id);
    for (const id of result.ids) syncedSessionIds.add(id);
    for (const id of refused) syncedSessionIds.add(id);
    writeSyncedIds(userId);

    applyingRemote = true;
    const current = getState();
    hydrateState({
      ...current,
      sessions: refused.size
        ? current.sessions.filter((s) => !refused.has(s.id))
        : current.sessions,
      coins: result.coins,
    });
    applyingRemote = false;
  }

  // Standings just moved — refresh any leaderboard on screen right away.
  announceLeaderboardChange();
}

function schedulePush(userId: string) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (!isOnline()) {
      setPendingPush(true, userId);
      return;
    }
    lastPushAt = Date.now();
    void push(userId)
      .then(() => {
        const hasUnsynced = getState().sessions.some((s) => !syncedSessionIds.has(s.id));
        setPendingPush(hasUnsynced, userId);
      })
      .catch(() => {
        setPendingPush(true, userId);
      })
      .finally(() => {
        lastPushAt = Date.now();
      });
  }, 400);
}

let channel: ReturnType<typeof supabase.channel> | null = null;

/** Start mirroring local store changes to the cloud for this user. */
export function startCloudSync(userId: string) {
  stopCloudSync();
  startConnectivityWatch();
  currentUserId = userId;
  syncedSessionIds = readSyncedIds(userId);
  pendingPush = readPendingPush(userId);
  if (!stopReconnect) {
    stopReconnect = onReconnect(() => {
      const uid = currentUserId;
      if (!uid) return;
      // Push first (dedup guarded), then pull the authoritative result.
      if (pendingPush) {
        void pullFromCloud(uid)
          .then(() => {
            if (!pendingPush) return undefined;
            setPendingPush(false, uid);
            lastPushAt = Date.now();
            return push(uid);
          })
          .catch(() => {
            setPendingPush(true, uid);
          })
          .finally(() => {
            lastPushAt = Date.now();
            schedulePull(uid);
          });
      } else {
        void pullFromCloud(uid)
          .then(() => {
            if (!pendingPush) return undefined;
            setPendingPush(false, uid);
            lastPushAt = Date.now();
            return push(uid);
          })
          .catch(() => {
            setPendingPush(true, uid);
          })
          .finally(() => {
            lastPushAt = Date.now();
          });
      }
    });
  }
  unsubscribe = subscribe(() => {
    if (applyingRemote || !currentUserId) return;
    const uid = currentUserId;
    // Persist immediately so an app kill before the debounce fires cannot
    // erase knowledge of an offline balance/session update.
    setPendingPush(true, uid);
    schedulePush(uid);
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

  // Safety net for missed live updates (e.g. group/Focus Class sessions saved
  // on another device): re-pull whenever the user comes back to the app.
  if (typeof window !== "undefined") {
    const onBack = () => {
      if (document.visibilityState === "hidden") return;
      if (currentUserId && isOnline() && !pendingPush) schedulePull(currentUserId);
    };
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onBack);
    stopFocusPull = () => {
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }
}

let stopFocusPull: (() => void) | null = null;

/** Ask for a fresh copy of sessions, coins and hours (e.g. when opening Profile). */
export function refreshFromCloud() {
  if (currentUserId && isOnline() && !pendingPush) schedulePull(currentUserId);
}

/** Local sessions the server has not answered for yet (offline / retrying). */
export function getPendingSessions(sessions: Session[] = getState().sessions) {
  if (!currentUserId) return [];
  return sessions.filter((s) => !syncedSessionIds.has(s.id));
}

/** Marks a session the server already accepted, so it is never re-sent. */
export function markSessionSynced(id: string) {
  syncedSessionIds.add(id);
  if (currentUserId) writeSyncedIds(currentUserId);
}

/**
 * Sends every waiting session outcome now (best effort, bounded). Called before
 * a new commitment so an earlier finished session is recorded against its own
 * claim before a new one starts.
 */
export async function flushPendingSessions(timeoutMs = 6000) {
  const uid = currentUserId;
  if (!uid || !isOnline() || getPendingSessions().length === 0) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  lastPushAt = Date.now();
  const run = push(uid)
    .then(() => setPendingPush(getPendingSessions().length > 0, uid))
    .catch(() => setPendingPush(true, uid))
    .finally(() => {
      lastPushAt = Date.now();
    });
  await Promise.race([run, new Promise((r) => setTimeout(r, timeoutMs))]);
}

export function stopCloudSync() {
  if (stopFocusPull) stopFocusPull();
  stopFocusPull = null;
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  if (stopReconnect) stopReconnect();
  stopReconnect = null;
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
