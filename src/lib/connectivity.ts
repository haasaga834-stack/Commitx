import { useEffect, useState } from "react";

/**
 * Connectivity detection for CommitX.
 *
 * The whole app is local-first: the store lives in localStorage and the session
 * timer is anchored to `Date.now()`, so losing the network never affects focus
 * time. This module only tells the UI (and the cloud sync layer) whether the
 * backend is reachable right now.
 */

/** Friendly copy for actions that genuinely need the network. */
export const OFFLINE_ACTION_MESSAGE =
  "You're offline. Please connect to the internet and try again.";

type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();
const reconnectListeners = new Set<() => void>();

let online = true;
let started = false;
let probeTimer: ReturnType<typeof setTimeout> | null = null;

/** Latest known connectivity state. Always `true` during SSR. */
export function isOnline() {
  if (typeof navigator === "undefined") return true;
  return online;
}

function setOnline(next: boolean) {
  if (next === online) return;
  online = next;
  for (const l of listeners) {
    try {
      l(next);
    } catch {}
  }
  if (next) {
    for (const l of reconnectListeners) {
      try {
        l();
      } catch {}
    }
  }
}

/**
 * `navigator.onLine` only proves a local interface exists, so confirm with a
 * tiny same-origin request. A failure here means "no usable internet".
 */
async function probe(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (typeof fetch === "undefined") return true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch(`/favicon.png?ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

function scheduleProbe(delay = 0) {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void probe().then(setOnline);
  }, delay);
}

/** Idempotent: starts the browser listeners once per page. */
export function startConnectivityWatch() {
  if (started || typeof window === "undefined") return;
  started = true;
  online = navigator.onLine !== false;

  window.addEventListener("online", () => {
    // Interfaces come up before routing works; confirm shortly after.
    scheduleProbe(600);
  });
  window.addEventListener("offline", () => setOnline(false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleProbe(200);
  });
  scheduleProbe(1500);
}

/** Subscribe to connectivity changes. Returns an unsubscribe function. */
export function subscribeConnectivity(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Runs when connectivity is restored — used to flush pending cloud writes. */
export function onReconnect(listener: () => void) {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

/** React binding for the current connectivity state. */
export function useOnline() {
  const [value, setValue] = useState(true);
  useEffect(() => {
    startConnectivityWatch();
    setValue(isOnline());
    return subscribeConnectivity(setValue);
  }, []);
  return value;
}
