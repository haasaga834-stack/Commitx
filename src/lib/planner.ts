import { useEffect, useState } from "react";

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
  write([
    ...getPlans(),
    { ...plan, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() },
  ]);
}

export function removePlan(id: string) {
  write(getPlans().filter((p) => p.id !== id));
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
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
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
 * Daily study goal (separate from schedules)
 * ------------------------------------------------------------------------ */

const GOAL_KEY = "commitx-daily-goal-v1";
export const DEFAULT_DAILY_GOAL_HOURS = 2;

const goalListeners = new Set<() => void>();
let goalCache: number | null = null;

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

export function setDailyGoalHours(hours: number) {
  const clamped = Math.min(16, Math.max(0.5, hours));
  goalCache = clamped;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(GOAL_KEY, String(clamped));
    } catch {}
  }
  goalListeners.forEach((l) => l());
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
