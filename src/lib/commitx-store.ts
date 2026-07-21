import { useEffect, useState } from "react";

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
}

export interface Profile {
  name: string;
  age: string;
  sex: string;
  education: string;
}

export interface AppState {
  balance: number;
  sessions: Session[];
  profile: Profile;
}

const KEY = "commitx-state-v1";

const initial: AppState = {
  balance: 500,
  sessions: [],
  profile: {
    name: "Arjun Mehta",
    age: "24",
    sex: "Male",
    education: "B.Tech, Computer Science",
  },
};

function read(): AppState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) };
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

export function stats(sessions: Session[]) {
  const completed = sessions.filter((s) => s.status === "completed");
  const failed = sessions.filter((s) => s.status === "failed");
  const totalMinutes = completed.reduce((sum, s) => sum + s.durationMinutes, 0);
  const successRate =
    sessions.length === 0 ? 0 : Math.round((completed.length / sessions.length) * 100);

  // streak: consecutive days with at least one completed session ending today or yesterday
  const days = new Set(
    completed.map((s) => new Date(s.date).toDateString()),
  );
  let streak = 0;
  const d = new Date();
  // allow starting from today or yesterday
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  // longest streak
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

  return {
    completed: completed.length,
    failed: failed.length,
    totalMinutes,
    successRate,
    streak,
    longest,
    todayMinutes,
  };
}
