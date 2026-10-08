import { useEffect, useState, useSyncExternalStore } from "react";

export type Mode = "standard" | "verified";
export type Status = "completed" | "failed";

export interface Session {
  id: string;
  goal: string;
  durationMinutes: number;
  value: number;
  mode: Mode;
  status: Status;
  date: number;
  /** Cx Coins forfeited when a commitment was not kept. */
  coinsSpent?: number;
  /** Cx Coins rewarded for completed study hours. */
  coinsEarned?: number;
}

export interface Profile {
  name: string;
  age: string;
  sex: string;
  education: string;
  /** Optional profile picture (downscaled data URL). */
  photo?: string;
}

export interface AppState {
  /** Cx Coin balance. Cx Coins are in-app points with no cash value. */
  coins: number;
  sessions: Session[];
  profile: Profile;
  referralCredited?: boolean;
  /** User preference: whether CommitX may post notifications. */
  notificationsEnabled?: boolean;
}

const KEY = "commitx-state-v2";
const LEGACY_KEY = "commitx-state-v1";

/** Cx Coin rules. Cx Coins are in-app points: not cash, not withdrawable. */
export const MIN_COMMIT = 50;
export const MAX_COMMIT = 500;
/** Cx Coins granted to both sides of a successful referral. */
export const REFERRAL_REWARD = 100;
/** Cx Coins granted on sign-up (a referral code adds REFERRAL_REWARD on top). */
export const WELCOME_COINS = 300;
/** Cx Coins earned per fully completed study hour. */
export const COINS_PER_HOUR = 25;

/** Cx Coins earned for a completed session of `minutes` (whole hours only). */
export function coinsForMinutes(minutes: number) {
  return COINS_PER_HOUR * Math.floor(Math.max(0, minutes) / 60);
}

const initial: AppState = {
  coins: WELCOME_COINS,
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
  if (typeof raw.coins === "number") return { ...initial, ...raw };
  // Older shapes stored a demo/real split or a single `balance`.
  const legacy =
    typeof raw?.balances?.demo === "number"
      ? raw.balances.demo
      : typeof raw?.balance === "number"
        ? raw.balance
        : WELCOME_COINS;
  const { balances: _drop, balance: _drop2, ...rest } = raw;
  return { ...initial, ...rest, coins: Math.max(0, Math.round(legacy)) };
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

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppState() {
  // useSyncExternalStore only re-renders when the state object actually
  // changes, instead of on every notification.
  const state = useSyncExternalStore(subscribeStore, ensure, () => initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const fresh = read();
    setHydrated(true);
    if (JSON.stringify(fresh) !== JSON.stringify(current)) {
      current = fresh;
      listeners.forEach((l) => l());
    }
  }, []);
  return { state, hydrated };
}

const coinFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Plain coin count, e.g. "1,250". */
export function formatCoins(n: number) {
  return coinFmt.format(Math.max(0, Math.round(n)));
}

/** Coin count with unit, e.g. "50 Cx Coins". */
export function coinLabel(n: number) {
  const v = Math.max(0, Math.round(n));
  return `${coinFmt.format(v)} Cx Coin${v === 1 ? "" : "s"}`;
}

/** Whether the user holds enough Cx Coins for a commitment. */
export function canAfford(value: number, coins: number) {
  return value <= coins;
}

/** Stable local ID used to de-duplicate offline-created session records. */
export function createLocalSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Older WebViews: still a valid v4 UUID so the server can record it.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}


let statsCacheKey: Session[] | null = null;
let statsCacheDay = "";
let statsCacheValue: ReturnType<typeof computeStats> | null = null;

/** Stats are pure over (sessions, calendar day) — cache to avoid recompute storms. */
export function stats(sessions: Session[]) {
  const day = new Date().toDateString();
  if (statsCacheValue && statsCacheKey === sessions && statsCacheDay === day) {
    return statsCacheValue;
  }
  const value = computeStats(sessions);
  statsCacheKey = sessions;
  statsCacheDay = day;
  statsCacheValue = value;
  return value;
}

function computeStats(sessions: Session[]) {
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

  // Cx Coins earned from completed sessions (whole hours only).
  const coinsEarned = completed.reduce(
    (sum, s) => sum + (s.coinsEarned ?? coinsForMinutes(s.durationMinutes)),
    0,
  );

  return {
    completed: completed.length,
    failed: failed.length,
    totalMinutes,
    successRate,
    streak,
    longest,
    todayMinutes,
    coinsEarned,
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
  hydrateState({ ...initial, coins: 0, sessions: [] });
}
