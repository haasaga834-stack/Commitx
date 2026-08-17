import { useEffect, useState } from "react";

export type Mode = "standard" | "verified";
export type Status = "completed" | "failed";
export type Pool = "demo" | "real";

export interface Session {
  id: string;
  goal: string;
  durationMinutes: number;
  value: number;
  mode: Mode;
  status: Status;
  date: number;
  /** How much of `value` was pulled from each pool at commit time. */
  demoUsed?: number;
  realUsed?: number;
}

export interface Profile {
  name: string;
  age: string;
  sex: string;
  education: string;
  /** Optional profile picture (downscaled data URL). */
  photo?: string;
}


export interface Balances {
  real: number;
  demo: number;
}

export interface AppState {
  balances: Balances;
  sessions: Session[];
  profile: Profile;
  referralCredited?: boolean;
  /** User preference: whether CommitX may post notifications. */
  notificationsEnabled?: boolean;
}

const KEY = "commitx-state-v2";
const LEGACY_KEY = "commitx-state-v1";

/** Deposit + wallet rules. */
export const MIN_DEPOSIT = 50;
export const MAX_REAL_WALLET = 1000;
export const MIN_COMMIT = 50;
export const MAX_COMMIT = 500;
export const REFERRAL_BONUS = 100;
/** Demo balance granted on sign-up (a referral code adds REFERRAL_BONUS on top). */
export const WELCOME_DEMO = 200;

const initial: AppState = {
  balances: { real: 0, demo: WELCOME_DEMO },
  sessions: [],
  profile: {
    name: "Arjun Mehta",
    age: "24",
    sex: "Male",
    education: "B.Tech, Computer Science",
  },
  referralCredited: false,
  notificationsEnabled: true,
};

function migrate(raw: any): AppState {
  if (!raw) return initial;
  // v2 shape
  if (raw.balances && typeof raw.balances.demo === "number") {
    return { ...initial, ...raw, balances: { ...initial.balances, ...raw.balances } };
  }
  // v1 shape: single `balance` -> treat as demo
  if (typeof raw.balance === "number") {
    return {
      ...initial,
      ...raw,
      balances: { real: 0, demo: raw.balance },
    };
  }
  return { ...initial, ...raw };
}

function read(): AppState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrate(JSON.parse(legacy));
    return initial;
  } catch {
    return initial;
  }
}

function write(s: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

const listeners = new Set<() => void>();
let current: AppState | null = null;

function ensure(): AppState {
  if (!current) current = read();
  return current;
}

export function getState(): AppState {
  return ensure();
}

export function setState(updater: (s: AppState) => AppState) {
  current = updater(ensure());
  write(current);
  listeners.forEach((l) => l());
}

export function useAppState() {
  const [, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    current = read();
    setHydrated(true);
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { state: ensure(), hydrated };
}

/** Indian rupee formatting: ₹1,00,000 style grouping. */
const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export function formatINR(n: number) {
  return `₹${inrFmt.format(Math.max(0, Math.round(n)))}`;
}

/**
 * Plan how to split a commitment amount across pools.
 * Preference: demo first (unless preferReal), then real.
 */
export function planDeduction(
  value: number,
  balances: Balances,
  preferReal = false,
): { demoUsed: number; realUsed: number; ok: boolean } {
  const total = balances.demo + balances.real;
  if (value > total) return { demoUsed: 0, realUsed: 0, ok: false };
  if (preferReal) {
    const realUsed = Math.min(value, balances.real);
    return { demoUsed: value - realUsed, realUsed, ok: true };
  }
  const demoUsed = Math.min(value, balances.demo);
  return { demoUsed, realUsed: value - demoUsed, ok: true };
}

export function stats(sessions: Session[]) {
  const completed = sessions.filter((s) => s.status === "completed");
  const failed = sessions.filter((s) => s.status === "failed");
  const totalMinutes = completed.reduce((sum, s) => sum + s.durationMinutes, 0);
  const successRate =
    sessions.length === 0 ? 0 : Math.round((completed.length / sessions.length) * 100);

  const days = new Set(completed.map((s) => new Date(s.date).toDateString()));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const sortedDays = Array.from(days)
    .map((s) => new Date(s).getTime())
    .sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev = 0;
  for (const t of sortedDays) {
    if (prev && t - prev <= 1000 * 60 * 60 * 26) run++;
    else run = 1;
    if (run > longest) longest = run;
    prev = t;
  }

  const todayMinutes = completed
    .filter((s) => new Date(s.date).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const foodCoins = Math.floor(totalMinutes / 60);

  return {
    completed: completed.length,
    failed: failed.length,
    totalMinutes,
    successRate,
    streak,
    longest,
    todayMinutes,
    foodCoins,
  };
}

/** Subscribe to store changes (used by cloud sync). */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replace local state with server state without notifying sync listeners twice. */
export function hydrateState(next: AppState) {
  current = next;
  write(next);
  listeners.forEach((l) => l());
}

/** Reset to a clean slate (used after account deletion / sign-out). */
export function resetState() {
  hydrateState({ ...initial, balances: { real: 0, demo: 0 }, sessions: [] });
}
