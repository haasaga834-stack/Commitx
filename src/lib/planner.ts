import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncTodoNotification, syncStudyPlanReminders } from "@/lib/native-notifications";
import { isOnline, onReconnect, startConnectivityWatch } from "./connectivity";
import { hasLiveSession } from "./session-guard";
import { ackPlannerWrite, queuePlannerWrite, readPlannerWrites, type PlannerWrite } from "./planner-outbox";

export type Repeat = "daily" | "weekly" | "monthly";
export type Priority = "high" | "medium" | "low";

export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export function priorityLabel(p: Priority) {
  return p === "high" ? "High" : p === "low" ? "Low" : "Medium";
}

export interface StudyPlan {
  id: string;
  subject: string;
  /** Topic / task inside the subject (optional) */
  topic?: string;
  /** HH:MM 24h */
  time: string;
  durationMinutes: number;
  repeat: Repeat;
  priority: Priority;
  /** Optional commitment in Cx Coins */
  commitValue?: number;
  /** 0=Sun..6=Sat — used when repeat = weekly */
  weekday?: number;
  /** 1..31 — used when repeat = monthly */
  monthday?: number;
  createdAt: number;
}


const KEY = "commitx-planner-v1";
const NOTIFIED_KEY = "commitx-planner-notified-v1";

/* ---------------------------------------------------------------------------
 * Cloud identity — set by useAuth when a session is available.
 * localStorage is only an offline mirror of what lives in the cloud.
 * ------------------------------------------------------------------------ */

let cloudUserId: string | null = null;
let identityGeneration = 0;
let syncWorker: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stopReconnect: (() => void) | null = null;

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const listeners = new Set<() => void>();
let cache: StudyPlan[] | null = null;

function read(): StudyPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StudyPlan[]) : [];
  } catch {
    return [];
  }
}

function write(plans: StudyPlan[]) {
  cache = plans;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(plans));
    } catch {}
  }
  // Hand the schedule to Android so a reminder fires 10 minutes before each
  // session even when the app is closed.
  syncStudyPlanReminders(
    plans.map((p) => ({
      id: p.id,
      subject: p.subject,
      topic: p.topic ?? "",
      time: p.time,
      durationMinutes: p.durationMinutes,
      repeat: p.repeat,
      weekday: p.weekday,
      monthday: p.monthday,
    })),
  );
  listeners.forEach((l) => l());
}

export function getPlans(): StudyPlan[] {
  if (!cache) cache = read();
  return cache;
}

function toRow(row: StudyPlan, userId: string) {
  return {
    id: row.id,
    user_id: userId,
    subject: row.subject,
    topic: row.topic ?? "",
    time: row.time,
    duration_minutes: row.durationMinutes,
    repeat: row.repeat,
    priority: row.priority,
    commit_value: row.commitValue ?? null,
    weekday: row.weekday ?? null,
    monthday: row.monthday ?? null,
  };
}

function queueWrite(table: PlannerWrite["table"], row: Record<string, unknown>, remove = false) {
  const uid = cloudUserId;
  if (!uid) return;
  queuePlannerWrite(uid, { id: newId(), table, row, remove });
  void reconcilePlanner(uid);
}

async function replayPlannerWrites(uid: string, generation: number) {
  if (!isOnline() || !(await hasLiveSession(uid))) return false;
  for (const item of readPlannerWrites(uid)) {
    if (cloudUserId !== uid || identityGeneration !== generation) return false;
    const result = item.remove && item.table !== "user_settings"
      ? await supabase.from(item.table).delete().eq("id", String(item.row.id)).eq("user_id", uid)
      : await supabase.from(item.table).upsert({ ...item.row, user_id: uid } as never,
          { onConflict: item.table === "user_settings" ? "user_id" : "id" });
    if (result.error) throw result.error;
    ackPlannerWrite(uid, item.id);
  }
  return cloudUserId === uid && identityGeneration === generation && !readPlannerWrites(uid).length;
}

export function reconcilePlanner(uid: string): Promise<void> {
  if (syncWorker) return syncWorker;
  if (!isOnline() || cloudUserId !== uid) return Promise.resolve();
  const generation = identityGeneration;
  syncWorker = (async () => {
    try {
      if (await replayPlannerWrites(uid, generation)) await pullPlannerFromCloud(uid);
    } catch {
      // Leave every unacknowledged write durable and retry without another user edit.
    } finally {
      syncWorker = null;
      if (retryTimer) clearTimeout(retryTimer);
      const current = cloudUserId;
      if (current && isOnline() && (current !== uid || readPlannerWrites(current).length)) {
        retryTimer = setTimeout(() => { retryTimer = null; void reconcilePlanner(current); }, 3000);
      }
    }
  })();
  return syncWorker;
}

export function addPlan(plan: Omit<StudyPlan, "id" | "createdAt">) {
  // Prevent duplicates: same subject + time + repeat is treated as the same plan.
  const duplicate = getPlans().find(
    (p) =>
      p.subject.trim().toLowerCase() === plan.subject.trim().toLowerCase() &&
      p.time === plan.time &&
      p.repeat === plan.repeat &&
      p.weekday === plan.weekday &&
      p.monthday === plan.monthday,
  );
  if (duplicate) {
    const merged: StudyPlan = { ...duplicate, ...plan };
    write(getPlans().map((p) => (p.id === merged.id ? merged : p)));
    queueWrite("study_plans", toRow(merged, cloudUserId ?? ""));
    return merged;
  }

  const row: StudyPlan = { ...plan, id: newId(), createdAt: Date.now() };
  write([...getPlans(), row]);
  queueWrite("study_plans", toRow(row, cloudUserId ?? ""));
  return row;
}

/**
 * Onboarding / "What should I do next?" plan.
 * Updates the user's existing plan when there is one so we never create a
 * duplicate record; otherwise inserts a single new plan. Throws on failure so
 * the caller can show an error and let the user retry.
 */
export async function savePrimaryPlan(
  plan: Omit<StudyPlan, "id" | "createdAt">,
): Promise<StudyPlan> {
  const existing = getPlans()[0];
  const row: StudyPlan = existing
    ? { ...existing, ...plan }
    : { ...plan, id: newId(), createdAt: Date.now() };

  write(existing ? getPlans().map((p) => (p.id === row.id ? row : p)) : [...getPlans(), row]);
  queueWrite("study_plans", toRow(row, cloudUserId ?? ""));
  return row;
}


export function removePlan(id: string) {
  write(getPlans().filter((p) => p.id !== id));
  queueWrite("study_plans", { id }, true);
}

export function usePlans() {
  const [, tick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    cache = read();
    setHydrated(true);
    write(cache);
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    // Keep other tabs / the native shell in step with plan changes.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = read();
        tick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return { plans: getPlans(), hydrated };
}

/** Next occurrence of a plan, as a timestamp, at or after `from`. */
export function nextOccurrence(plan: StudyPlan, from = Date.now()): number {
  const [h, m] = plan.time.split(":").map((n) => parseInt(n, 10));
  const base = new Date(from);

  const at = (d: Date) => {
    const x = new Date(d);
    x.setHours(h || 0, m || 0, 0, 0);
    return x.getTime();
  };

  if (plan.repeat === "daily") {
    const today = at(base);
    return today >= from ? today : today + 24 * 3600 * 1000;
  }

  if (plan.repeat === "weekly") {
    const target = plan.weekday ?? base.getDay();
    for (let i = 0; i < 8; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      if (d.getDay() === target) {
        const t = at(d);
        if (t >= from) return t;
      }
    }
    return at(base) + 7 * 24 * 3600 * 1000;
  }

  // monthly
  const day = plan.monthday ?? base.getDate();
  for (let i = 0; i < 3; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, day);
    const t = at(d);
    if (t >= from && d.getDate() === day) return t;
  }
  return at(base) + 30 * 24 * 3600 * 1000;
}

/**
 * Timestamp of this plan's slot on the day of `from` when it occurs that day,
 * otherwise null. Used for "Today's Plan" so a session stays listed for the
 * rest of the day even after its start time has passed.
 */
export function occursOn(plan: StudyPlan, from = Date.now()): number | null {
  const [h, m] = plan.time.split(":").map((n) => parseInt(n, 10));
  const d = new Date(from);
  if (plan.repeat === "weekly" && (plan.weekday ?? d.getDay()) !== d.getDay()) return null;
  if (plan.repeat === "monthly" && (plan.monthday ?? d.getDate()) !== d.getDate()) return null;
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

/**
 * The single most relevant upcoming session: the soonest occurrence that has
 * not finished yet (a session already running still counts).
 */
export function upcomingPlan(
  plans: StudyPlan[],
  from = Date.now(),
): { plan: StudyPlan; at: number } | null {
  let best: { plan: StudyPlan; at: number } | null = null;
  for (const plan of plans) {
    const today = occursOn(plan, from);
    const at =
      today !== null && from < today + plan.durationMinutes * 60_000
        ? today
        : nextOccurrence(plan, from);
    if (!best || at < best.at) best = { plan, at };
  }
  return best;
}

export function formatTime(time: string) {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m || 0).padStart(2, "0")} ${period}`;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function repeatLabel(plan: StudyPlan) {
  if (plan.repeat === "daily") return "Every day";
  if (plan.repeat === "weekly") return `Every ${WEEKDAYS[plan.weekday ?? 1]}`;
  return `Day ${plan.monthday ?? 1} each month`;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    setRemindersEnabled(true);
    return true;
  }
  if (Notification.permission === "denied") {
    setRemindersEnabled(false);
    return false;
  }
  try {
    const res = await Notification.requestPermission();
    const ok = res === "granted";
    setRemindersEnabled(ok);
    return ok;
  } catch {
    return false;
  }
}

function readNotified(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeNotified(v: Record<string, number>) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(v));
  } catch {}
}

const LEAD_MS = 10 * 60 * 1000;

/** Polls scheduled plans and fires a reminder 10 minutes before each session. */
export function useStudyReminders() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = Date.now();
      const notified = readNotified();
      let dirty = false;

      for (const plan of getPlans()) {
        const at = nextOccurrence(plan, now);
        const fireAt = at - LEAD_MS;
        const key = `${plan.id}:${at}`;
        if (now >= fireAt && now < at && !notified[key]) {
          try {
            new Notification("Study session in 10 minutes", {
              body: `${plan.subject} · ${formatTime(plan.time)} · ${plan.durationMinutes} min`,
              tag: key,
              icon: "/icons/icon-192x192.png",
            });
          } catch {}
          notified[key] = now;
          dirty = true;
        }
      }

      // prune old entries
      for (const k of Object.keys(notified)) {
        if (now - notified[k] > 3 * 24 * 3600 * 1000) {
          delete notified[k];
          dirty = true;
        }
      }
      if (dirty) writeNotified(notified);
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
}

/* ---------------------------------------------------------------------------
 * Daily study goal + reminder preference (cloud-backed user settings)
 * ------------------------------------------------------------------------ */

const GOAL_KEY = "commitx-daily-goal-v1";
export const DEFAULT_DAILY_GOAL_HOURS = 2;

const goalListeners = new Set<() => void>();
let goalCache: number | null = null;
let remindersEnabled = true;

function readGoal(): number {
  if (typeof window === "undefined") return DEFAULT_DAILY_GOAL_HOURS;
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_GOAL_HOURS;
  } catch {
    return DEFAULT_DAILY_GOAL_HOURS;
  }
}

export function getDailyGoalHours(): number {
  if (goalCache === null) goalCache = readGoal();
  return goalCache;
}

function writeGoalLocal(hours: number) {
  goalCache = hours;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(GOAL_KEY, String(hours));
    } catch {}
  }
  goalListeners.forEach((l) => l());
}

export function setDailyGoalHours(hours: number) {
  const clamped = Math.min(16, Math.max(0.5, hours));
  writeGoalLocal(clamped);
  void upsertSettings({ daily_goal_hours: clamped });
}

export function setRemindersEnabled(enabled: boolean) {
  remindersEnabled = enabled;
  void upsertSettings({ reminders_enabled: enabled });
}

export function getRemindersEnabled() {
  return remindersEnabled;
}

async function upsertSettings(patch: Record<string, unknown>) {
  queueWrite("user_settings", patch);
}

/** Persist the theme choice with the rest of the user's cloud settings. */
export function syncThemeToCloud(theme: "light" | "dark") {
  void upsertSettings({ theme });
}

export function useDailyGoal() {
  const [, tick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    goalCache = readGoal();
    setHydrated(true);
    const l = () => tick((t) => t + 1);
    goalListeners.add(l);
    return () => {
      goalListeners.delete(l);
    };
  }, []);
  return { goalHours: getDailyGoalHours(), setGoalHours: setDailyGoalHours, hydrated };
}

export function formatGoalHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
}

/* ---------------------------------------------------------------------------
 * Duration options (30 minutes .. 6 hours, 30 minute steps)
 * ------------------------------------------------------------------------ */

export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 360;
export const DURATION_STEP_MINUTES = 30;

export const DURATION_OPTIONS: number[] = (() => {
  const out: number[] = [];
  for (let m = MIN_DURATION_MINUTES; m <= MAX_DURATION_MINUTES; m += DURATION_STEP_MINUTES)
    out.push(m);
  return out;
})();

export function clampDuration(m: number) {
  const n = Math.round(m / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES;
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, n));
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ---------------------------------------------------------------------------
 * Today's to-do list (cloud-backed)
 * ------------------------------------------------------------------------ */

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  /** YYYY-MM-DD local day the item belongs to */
  day: string;
}

const TODO_KEY = "commitx-todos-v1";

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const todoListeners = new Set<() => void>();
let todoCache: TodoItem[] | null = null;

function readTodos(): TodoItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TODO_KEY);
    const all = raw ? (JSON.parse(raw) as TodoItem[]) : [];
    const today = todayKey();
    return all.filter((t) => t.day === today);
  } catch {
    return [];
  }
}

function writeTodos(items: TodoItem[]) {
  todoCache = items;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(TODO_KEY, JSON.stringify(items));
    } catch {}
  }
  todoListeners.forEach((l) => l());
  // Keep the persistent Android notification in step with the list.
  syncTodoNotification(items);
}

export function getTodos(): TodoItem[] {
  if (!todoCache) todoCache = readTodos();
  return todoCache;
}

/** Native widget observes existing mirrors; never writes session or wallet totals. */
export function subscribePlannerWidget(listener: () => void) {
  todoListeners.add(listener);
  goalListeners.add(listener);
  return () => { todoListeners.delete(listener); goalListeners.delete(listener); };
}

export function addTodo(text: string) {
  const t = text.trim();
  if (!t) return;
  const item: TodoItem = { id: newId(), text: t, done: false, day: todayKey() };
  writeTodos([...getTodos(), item]);
  queueWrite("todos", { ...item });
}

export function toggleTodo(id: string) {
  const next = getTodos().map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  writeTodos(next);
  const updated = next.find((t) => t.id === id);
  if (updated) queueWrite("todos", { ...updated });
}

/** Marks a to-do done; never un-completes it. Returns true if it changed. */
export function completeTodo(id: string): boolean {
  const item = getTodos().find((t) => t.id === id);
  if (!item || item.done) return false;
  toggleTodo(id);
  return true;
}

export function removeTodo(id: string) {
  writeTodos(getTodos().filter((t) => t.id !== id));
  queueWrite("todos", { id }, true);
}

export function useTodos() {
  const [, tick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    todoCache = readTodos();
    setHydrated(true);
    const l = () => tick((t) => t + 1);
    todoListeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === TODO_KEY) {
        todoCache = readTodos();
        tick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    syncTodoNotification(getTodos());
    // Lets the notification's "Done" action flip the task inside the app.
    window.CommitXTodos = { toggleFromNative: (id: string) => toggleTodo(id) };
    return () => {
      todoListeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return { todos: getTodos(), hydrated };
}

/* ---------------------------------------------------------------------------
 * Cloud hydration
 * ------------------------------------------------------------------------ */

/** Pull plans, today's to-dos and settings from the cloud. */
export async function pullPlannerFromCloud(userId: string) {
  const generation = identityGeneration;
  if (!isOnline() || cloudUserId !== userId || readPlannerWrites(userId).length) return null;
  if (!(await hasLiveSession(userId))) return null;
  const today = todayKey();
  const [plansRes, todosRes, settingsRes] = await Promise.all([
    supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("todos").select("*").eq("user_id", userId).eq("day", today),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (plansRes.error || todosRes.error || settingsRes.error) {
    throw plansRes.error ?? todosRes.error ?? settingsRes.error;
  }

  if (cloudUserId !== userId || generation !== identityGeneration || readPlannerWrites(userId).length) return null;
  const plans = plansRes.data;
  const todos = todosRes.data;
  const settings = settingsRes.data;

  write(
    (plans ?? []).map((r) => ({
      id: r.id,
      subject: r.subject,
      topic: r.topic ?? undefined,
      time: r.time,
      durationMinutes: r.duration_minutes,
      repeat: r.repeat as Repeat,
      priority: (r.priority as Priority) ?? "medium",
      commitValue: r.commit_value ?? undefined,
      weekday: r.weekday ?? undefined,
      monthday: r.monthday ?? undefined,
      createdAt: new Date(r.created_at).getTime(),
    })),

  );

  writeTodos(
    (todos ?? []).map((r) => ({
      id: r.id,
      text: r.text,
      done: r.done,
      day: r.day,
    })),
  );

  if (settings) {
    remindersEnabled = settings.reminders_enabled;
    writeGoalLocal(Number(settings.daily_goal_hours) || DEFAULT_DAILY_GOAL_HOURS);
    writeWeeklyGoalLocal(
      Number((settings as { weekly_goal_hours?: number }).weekly_goal_hours) ||
        DEFAULT_WEEKLY_GOAL_HOURS,
    );
  } else {
    await supabase
      .from("user_settings")
      .upsert(
        { user_id: userId, daily_goal_hours: getDailyGoalHours() },
        { onConflict: "user_id" },
      );
  }

  return settings;
}

/** Attach/detach the signed-in user. Called from useAuth. */
export function setPlannerUser(userId: string | null) {
  if (cloudUserId !== userId) {
    identityGeneration++;
    // Save presentation mirrors per owner before replacing shared compatibility keys.
    if (typeof window !== "undefined") {
      if (cloudUserId) saveOwnerMirror(cloudUserId);
      const priorOwner = localStorage.getItem("commitx-planner-owner");
      if (userId && priorOwner !== userId) {
        const saved = localStorage.getItem(`commitx-planner-mirror:${userId}`);
        const values = saved ? JSON.parse(saved) as Record<string, string> : {};
        for (const key of [KEY, TODO_KEY, GOAL_KEY, WEEKLY_GOAL_KEY]) {
          if (values[key] !== undefined) localStorage.setItem(key, values[key]);
          else localStorage.removeItem(key);
        }
      }
      if (userId) localStorage.setItem("commitx-planner-owner", userId);
    }
    cloudUserId = userId;
    cache = read(); todoCache = readTodos(); goalCache = readGoal(); weeklyCache = readWeeklyGoal();
    listeners.forEach(l => l()); todoListeners.forEach(l => l()); goalListeners.forEach(l => l()); weeklyListeners.forEach(l => l());
  }
  watchTodoChanges(userId);
  if (!userId) return;
  startConnectivityWatch();
  if (!stopReconnect) stopReconnect = onReconnect(() => {
    if (cloudUserId) void reconcilePlanner(cloudUserId);
  });
  void reconcilePlanner(userId);
}

function saveOwnerMirror(uid: string) {
  const values: Record<string, string> = {};
  for (const key of [KEY, TODO_KEY, GOAL_KEY, WEEKLY_GOAL_KEY]) {
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  localStorage.setItem(`commitx-planner-mirror:${uid}`, JSON.stringify(values));
}

// Live to-do changes from other devices/website refresh the list (and widget) at once.
let todoChannel: ReturnType<typeof supabase.channel> | null = null;
let todoChannelUser: string | null = null;
let todoPullTimer: ReturnType<typeof setTimeout> | null = null;
function watchTodoChanges(userId: string | null) {
  if (typeof window === "undefined" || todoChannelUser === userId) return;
  if (todoChannel) void supabase.removeChannel(todoChannel);
  todoChannel = null;
  todoChannelUser = userId;
  if (!userId) return;
  todoChannel = supabase
    .channel(`todos-${userId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "todos", filter: `user_id=eq.${userId}` }, () => {
      if (todoPullTimer) clearTimeout(todoPullTimer);
      todoPullTimer = setTimeout(() => {
        if (cloudUserId === userId && !readPlannerWrites(userId).length) void pullPlannerFromCloud(userId).catch(() => {});
      }, 400);
    })
    .subscribe();
}

/** Clear local mirrors (sign-out / account deletion). */
export function clearPlannerLocal() {
  if (cloudUserId && typeof window !== "undefined") saveOwnerMirror(cloudUserId);
  identityGeneration++;
  cloudUserId = null;
  watchTodoChanges(null);
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (stopReconnect) stopReconnect();
  stopReconnect = null;
  write([]);
  writeTodos([]);
  writeGoalLocal(DEFAULT_DAILY_GOAL_HOURS);
  writeWeeklyGoalLocal(DEFAULT_WEEKLY_GOAL_HOURS);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(NOTIFIED_KEY);
      localStorage.removeItem("commitx-planner-owner");
    } catch {}
  }
}

/* ---------------------------------------------------------------------------
 * Weekly study target (cloud-backed user setting, mirrors the daily target)
 * ------------------------------------------------------------------------ */

const WEEKLY_GOAL_KEY = "commitx-weekly-goal-v1";
export const DEFAULT_WEEKLY_GOAL_HOURS = 14;

const weeklyListeners = new Set<() => void>();
let weeklyCache: number | null = null;

function readWeeklyGoal(): number {
  if (typeof window === "undefined") return DEFAULT_WEEKLY_GOAL_HOURS;
  try {
    const raw = localStorage.getItem(WEEKLY_GOAL_KEY);
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_WEEKLY_GOAL_HOURS;
  } catch {
    return DEFAULT_WEEKLY_GOAL_HOURS;
  }
}

export function getWeeklyGoalHours(): number {
  if (weeklyCache === null) weeklyCache = readWeeklyGoal();
  return weeklyCache;
}

export function writeWeeklyGoalLocal(hours: number) {
  weeklyCache = hours;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(WEEKLY_GOAL_KEY, String(hours));
    } catch {}
  }
  weeklyListeners.forEach((l) => l());
}

export function setWeeklyGoalHours(hours: number) {
  const clamped = Math.min(100, Math.max(1, hours));
  writeWeeklyGoalLocal(clamped);
  void upsertSettings({ weekly_goal_hours: clamped });
}

export function useWeeklyGoal() {
  const [, tick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    weeklyCache = readWeeklyGoal();
    setHydrated(true);
    const l = () => tick((t) => t + 1);
    weeklyListeners.add(l);
    return () => {
      weeklyListeners.delete(l);
    };
  }, []);
  return { weeklyHours: getWeeklyGoalHours(), setWeeklyHours: setWeeklyGoalHours, hydrated };
}
