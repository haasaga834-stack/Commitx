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

/**
 * A freshly picked profile photo is "pinned" locally for a short while so a
 * background pull that raced the write can't wipe it from the UI.
 */
let localPhoto: { value: string; at: number } | null = null;
const PHOTO_PIN_MS = 60_000;

/** Write a newly picked (or removed) photo straight to the account. */
export async function saveProfilePhoto(photo: string) {
  localPhoto = { value: photo, at: Date.now() };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;
  await supabase
    .from("profiles")
    .update({ avatar_url: photo || null })
    .eq("id", userId);
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

  const remotePhoto =
    (profile as { avatar_url?: string | null } | null)?.avatar_url ?? "";
  let photo = remotePhoto;
  if (localPhoto) {
    if (localPhoto.value === remotePhoto || Date.now() - localPhoto.at > PHOTO_PIN_MS) {
      localPhoto = null;
    } else {
      photo = localPhoto.value;
    }
  }

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
      photo,
    },
    referralCredited: Boolean(profile?.referred_by),
  };

  applyingRemote = true;
  hydrateState(next);
  applyingRemote = false;

  return profile;
}

async function push(userId: string) {
  const state = getState();

  await supabase
    .from("wallets")
    .upsert(
      {
        user_id: userId,
        real_balance: Math.round(state.balances.real),
        demo_balance: Math.round(state.balances.demo),
      },
      { onConflict: "user_id" },
    );

  await supabase
    .from("profiles")
    .update({
      display_name: state.profile.name,
      age: state.profile.age,
      sex: state.profile.sex,
      education: state.profile.education,
      avatar_url: state.profile.photo || null,

    })
    .eq("id", userId);

  const unsynced = state.sessions.filter((s) => !syncedSessionIds.has(s.id));
  for (const s of unsynced) {
    syncedSessionIds.add(s.id);
    const { data } = await supabase
      .from("focus_sessions")
      .insert({
        user_id: userId,
        goal: s.goal,
        duration_minutes: s.durationMinutes,
        value: s.value,
        mode: s.mode,
        status: s.status,
        demo_used: s.demoUsed ?? 0,
        real_used: s.realUsed ?? 0,
        created_at: new Date(s.date).toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (data?.id) syncedSessionIds.add(data.id);
  }
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
      void push(currentUserId!).catch(() => {});
    }, 400);
  });

  // Keep other devices in step: any cloud change to this user's rows re-pulls.
  channel = supabase
    .channel(`commitx-user-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
      () => {
        if (currentUserId) void pullFromCloud(currentUserId).catch(() => {});
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "focus_sessions", filter: `user_id=eq.${userId}` },
      () => {
        if (currentUserId) void pullFromCloud(currentUserId).catch(() => {});
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
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
