import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Repeat = "daily" | "weekly" | "monthly";

export interface StudyPlan {
  id: string;
  subject: string;
  /** HH:MM 24h */
  time: string;
  durationMinutes: number;
  repeat: Repeat;
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
  listeners.forEach((l) => l());
}

export function getPlans(): StudyPlan[] {
  if (!cache) cache = read();
  return cache;
}

export function addPlan(plan: Omit<StudyPlan, "id" | "createdAt">) {
  const row: StudyPlan = { ...plan, id: newId(), createdAt: Date.now() };
  write([...getPlans(), row]);
  if (cloudUserId) {
    void supabase
      .from("study_plans")
      .insert({
        id: row.id,
        user_id: cloudUserId,
        subject: row.subject,
        time: row.time,
        duration_minutes: row.durationMinutes,
        repeat: row.repeat,
        weekday: row.weekday ?? null,
        monthday: row.monthday ?? null,
      })
      .then(() => {});
  }
}

export function removePlan(id: string) {
  write(getPlans().filter((p) => p.id !== id));
  if (cloudUserId) {
    void supabase.from("study_plans").delete().eq("id", id).then(() => {});
  }
}

export function usePlans() {
  const [, tick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    cache = read();
    setHydrated(true);
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
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
  if (!cloudUserId) return;
  try {
    await supabase
      .from("user_settings")
      .upsert({ user_id: cloudUserId, ...patch }, { onConflict: "user_id" });
  } catch {}
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
}

export function getTodos(): TodoItem[] {
  if (!todoCache) todoCache = readTodos();
  return todoCache;
}

export function addTodo(text: string) {
  const t = text.trim();
  if (!t) return;
  const item: TodoItem = { id: newId(), text: t, done: false, day: todayKey() };
  writeTodos([...getTodos(), item]);
  if (cloudUserId) {
    void supabase
      .from("todos")
      .insert({
        id: item.id,
        user_id: cloudUserId,
        text: item.text,
        done: false,
        day: item.day,
      })
      .then(() => {});
  }
}

export function toggleTodo(id: string) {
  const next = getTodos().map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  writeTodos(next);
  const updated = next.find((t) => t.id === id);
  if (cloudUserId && updated) {
    void supabase.from("todos").update({ done: updated.done }).eq("id", id).then(() => {});
  }
}

export function removeTodo(id: string) {
  writeTodos(getTodos().filter((t) => t.id !== id));
  if (cloudUserId) {
    void supabase.from("todos").delete().eq("id", id).then(() => {});
  }
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
  const today = todayKey();
  const [{ data: plans }, { data: todos }, { data: settings }] = await Promise.all([
    supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("todos").select("*").eq("user_id", userId).eq("day", today),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  write(
    (plans ?? []).map((r) => ({
      id: r.id,
      subject: r.subject,
      time: r.time,
      durationMinutes: r.duration_minutes,
      repeat: r.repeat as Repeat,
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
  cloudUserId = userId;
  if (!userId) return;
  void pullPlannerFromCloud(userId).catch(() => {});
}

/** Clear local mirrors (sign-out / account deletion). */
export function clearPlannerLocal() {
  cloudUserId = null;
  write([]);
  writeTodos([]);
  writeGoalLocal(DEFAULT_DAILY_GOAL_HOURS);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(NOTIFIED_KEY);
    } catch {}
  }
}
