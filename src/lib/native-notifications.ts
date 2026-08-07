/**
 * Bridge helpers for the Android notifications and Usage-Access screen time.
 * Every call is a safe no-op on the web where the native bridge is absent.
 */
import { useCallback, useEffect, useState } from "react";
import type { TodoItem } from "@/lib/planner";

function bridge() {
  return typeof window === "undefined" ? undefined : window.CommitXAndroid;
}

/* --------------------------- Permission handling ------------------------- */

export function notificationsSupported() {
  return !!bridge();
}

export function notificationsEnabled(): boolean | null {
  const b = bridge();
  if (!b?.notificationsEnabled) return null;
  try {
    return Boolean(b.notificationsEnabled());
  } catch {
    return null;
  }
}

export function requestNotificationPermission() {
  try {
    bridge()?.requestNotificationPermission?.();
  } catch {}
}

export function openNotificationSettings() {
  try {
    bridge()?.openNotificationSettings?.();
  } catch {}
}

/** Live notification-permission state; refreshes when the app regains focus. */
export function useNotificationPermission() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const refresh = useCallback(() => setEnabled(notificationsEnabled()), []);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.CommitXNotifications = {
      ...(window.CommitXNotifications ?? {}),
      onPermissionResult: (granted: boolean) => setEnabled(granted),
    };
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return {
    supported: notificationsSupported(),
    enabled,
    request: () => {
      requestNotificationPermission();
      setTimeout(refresh, 800);
    },
    openSettings: openNotificationSettings,
    refresh,
  };
}

/* ------------------------------ To-do notification ----------------------- */


export function syncTodoNotification(todos: TodoItem[]) {
  try {
    const payload = todos.map((t) => ({ id: t.id, text: t.text, done: t.done }));
    if (payload.length === 0) bridge()?.clearTodoNotification?.();
    else bridge()?.syncTodos?.(JSON.stringify(payload));
  } catch {}
}

export function clearTodoNotification() {
  try {
    bridge()?.clearTodoNotification?.();
  } catch {}
}

/* --------------------------- Session progress ---------------------------- */

export function showSessionProgress(title: string, text: string, progress: number) {
  try {
    bridge()?.showSessionProgress?.(title, text, Math.round(progress));
  } catch {}
}

export function hideSessionProgress() {
  try {
    bridge()?.hideSessionProgress?.();
  } catch {}
}

/* ------------------------------- Screen time ----------------------------- */

export interface ScreenTime {
  supported: boolean;
  granted: boolean;
  commitxMinutes: number;
  otherMinutes: number;
  limitMinutes: number;
  day: string;
}

export function readScreenTime(): ScreenTime | null {
  try {
    const raw = bridge()?.screenTimeToday?.();
    if (!raw) return null;
    return JSON.parse(raw) as ScreenTime;
  } catch {
    return null;
  }
}

export function openUsageAccessSettings() {
  try {
    bridge()?.openUsageAccessSettings?.();
  } catch {}
}

export function setScreenTimeLimit(minutes: number) {
  try {
    bridge()?.setScreenTimeLimit?.(Math.max(0, Math.round(minutes)));
  } catch {}
}

export function formatMinutes(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** Polls native screen time; resets naturally each day (native reads from midnight). */
export function useScreenTime(intervalMs = 60_000) {
  const [data, setData] = useState<ScreenTime | null>(null);

  const refresh = useCallback(() => setData(readScreenTime()), []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs]);

  const updateLimit = useCallback(
    (minutes: number) => {
      setScreenTimeLimit(minutes);
      refresh();
    },
    [refresh],
  );

  return { screenTime: data, refresh, updateLimit };
}
