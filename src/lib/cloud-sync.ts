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
      notifications_enabled: state.notificationsEnabled ?? true,
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
