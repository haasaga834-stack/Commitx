import { useEffect, useState } from "react";

/**
 * Commitment time is configured once in Settings and reused by every
 * "Swipe to Start Commitment" flow. Settings is the single source of truth.
 */
const KEY = "commitx-commit-duration-v1";

export const MIN_SESSION_MINUTES = 10;
export const MAX_SESSION_MINUTES = 360;

const listeners = new Set<() => void>();
let cache: number | null | undefined;

function read(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return null;
    return clampMinutes(n);
  } catch {
    return null;
  }
}

export function clampMinutes(n: number) {
  return Math.min(MAX_SESSION_MINUTES, Math.max(MIN_SESSION_MINUTES, Math.round(n)));
}

/** Saved commitment time in minutes, or null when the user hasn't set one. */
export function getSavedDuration(): number | null {
  if (cache === undefined) cache = read();
  return cache;
}

export function setSavedDuration(minutes: number) {
  const value = clampMinutes(minutes);
  cache = value;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, String(value));
    } catch {}
  }
  listeners.forEach((l) => l());
}

export function formatSessionDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Subscribe to the saved commitment time (SSR-safe, hydration-safe). */
export function useSavedDuration() {
  const [value, setValue] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    cache = read();
    setValue(cache);
    setHydrated(true);
    const l = () => setValue(getSavedDuration());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return { duration: value, setDuration: setSavedDuration, hydrated };
}
