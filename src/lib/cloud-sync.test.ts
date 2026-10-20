import { test, expect, mock, beforeEach } from "bun:test";

const storage = new Map<string, string>();
let online = true;
let state: any;
let listener: (() => void) | null = null;
let recordCalls = 0;
let failRecording = false;
let remote: any[] = [];
let pauseRead: Promise<void> | null = null;
const session = (id: string) => ({ id, goal: "Study", durationMinutes: 60, value: 50,
  mode: "standard", status: "completed", date: Date.now(), coinsEarned: 25 });
mock.module("./commitx-store", () => ({
  getState: () => state, hydrateState: (next: any) => { state = next; },
  subscribe: (fn: () => void) => { listener = fn; return () => { listener = null; }; },
  setStoreUser: () => {},
}));
mock.module("./connectivity", () => ({ isOnline: () => online, startConnectivityWatch: () => {}, onReconnect: () => () => {} }));
mock.module("./community", () => ({ announceLeaderboardChange: () => {} }));
mock.module("./session-guard", () => ({ hasLiveSession: async () => true }));
mock.module("./wallet.functions", () => ({ recordSessions: async ({ data }: any) => {
  recordCalls++;
  if (failRecording) { failRecording = false; throw new Error("temporary failure"); }
  return { ids: data.sessions.map((s: any) => s.id), rejected: [], retryable: [], coins: 325 };
} }));
const channel: any = { on: () => channel, subscribe: () => channel };
mock.module("@/integrations/supabase/client", () => ({ supabase: {
  channel: () => channel, removeChannel: () => {}, rpc: async () => ({ data: 0 }),
  from: (table: string) => {
    const q: any = { select: () => q, eq: () => q, order: () => q, range: () => q,
      update: () => q, maybeSingle: () => q,
      then: (resolve: any, reject: any) => (async () => {
        if (pauseRead && table === "focus_sessions") await pauseRead;
        return { error: null, data: table === "focus_sessions" ? remote : table === "wallets" ? { coin_balance: 300 } :
          { display_name: "Cloud", age: "", sex: "", education: "" } };
      })().then(resolve, reject) };
    return q;
  },
} }));
const sync = await import("./cloud-sync");
beforeEach(() => {
  sync.stopCloudSync(); storage.clear(); recordCalls = 0; failRecording = false; remote = []; pauseRead = null;
  online = true;
  state = { coins: 300, sessions: [], profile: { name: "Cloud", age: "", sex: "", education: "" } };
  Object.assign(globalThis, { window: { localStorage: { getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) },
    addEventListener: () => {}, removeEventListener: () => {} }, document: { visibilityState: "visible",
    addEventListener: () => {}, removeEventListener: () => {} } });
  sync.startCloudSync("owner");
});
test("an older identical completion never suppresses a new offline outcome", async () => {
  remote = [{ id: "old", goal: "Study", duration_minutes: 60, value: 50, mode: "standard", status: "completed", created_at: new Date().toISOString() }];
  state.sessions = [session("new")];
  await sync.pullFromCloud("owner");
  expect(sync.getPendingSessions().map((s: any) => s.id)).toEqual(["new"]);
  expect(state.sessions.length).toBe(2);
  sync.stopCloudSync();
});
test("a local completion and profile edit survive an in-flight pull", async () => {
  let release: (() => void) | undefined;
  pauseRead = new Promise<void>(r => { release = r; });
  const read = sync.pullFromCloud("owner");
  await new Promise(r => setTimeout(r, 10));
  state = { ...state, sessions: [session("local")], profile: { ...state.profile, name: "Edited" } };
  listener?.(); release?.();
  await read;
  expect(state.profile.name).toBe("Edited");
  expect(state.sessions[0].id).toBe("local");
  sync.stopCloudSync();
});
test("old-account responses cannot hydrate the current account", async () => {
  let release: (() => void) | undefined;
  pauseRead = new Promise<void>(r => { release = r; });
  const read = sync.pullFromCloud("owner");
  await new Promise(r => setTimeout(r, 10));
  sync.startCloudSync("other");
  state = { ...state, coins: 900, profile: { ...state.profile, name: "Other" } };
  release?.(); await read;
  expect(state.coins).toBe(900);
  expect(state.profile.name).toBe("Other");
  sync.stopCloudSync();
});
test("online request failure retries automatically without a new edit", async () => {
  state.sessions = [session("0a784082-52d8-4fe4-9b75-820eb1334c32")];
  failRecording = true;
  await sync.flushPendingSessions();
  expect(recordCalls).toBe(1);
  await new Promise(r => setTimeout(r, 1200));
  expect(recordCalls).toBe(2);
  expect(sync.getPendingSessions().length).toBe(0);
  sync.stopCloudSync();
});