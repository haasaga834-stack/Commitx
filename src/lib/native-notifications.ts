/**
 * Bridge helpers for the Android notifications and Usage-Access screen time.
 * Every call is a safe no-op on the web where the native bridge is absent.
 */
import { useCallback, useEffect, useState } from "react";
import type { TodoItem } from "@/lib/planner";
import { getState, setState } from "@/lib/commitx-store";
import { countdownPayload, type VerifiedCountdownPayload } from "@/lib/verified-countdown";

function bridge() {
  return typeof window === "undefined" ? undefined : window.CommitXAndroid;
}

/** The user's own notification preference (persisted per account). */
export function notificationsAllowed() {
  return getState().notificationsEnabled !== false;
}

/** Turn CommitX notifications on/off for this user; clears live ones when off. */
export function setNotificationsAllowed(allowed: boolean) {
  setState((s) => ({ ...s, notificationsEnabled: allowed }));
  if (!allowed) {
    clearTodoNotification();
    hideSessionProgress();
    try {
      bridge()?.setPlanRemindersEnabled?.(false);
    } catch {}
  }
  try {
    bridge()?.setMotivationNotifications?.(allowed);
    bridge()?.setPlanRemindersEnabled?.(allowed);
  } catch {}
}

/**
 * Re-arms the native daily motivation alarms (8:00 AM / 7:00 PM local time)
 * without ever creating duplicates. Safe to call on every app start.
 */
export function reconcileMotivationNotifications() {
  try {
    const b = bridge();
    if (!b) return;
    if (notificationsAllowed()) b.reconcileMotivationNotifications?.();
    else b.setMotivationNotifications?.(false);
  } catch {}
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
    if (payload.length === 0 || !notificationsAllowed())
      bridge()?.clearTodoNotification?.();
    else bridge()?.syncTodos?.(JSON.stringify(payload));
  } catch {}
}

export function clearTodoNotification() {
  try {
    bridge()?.clearTodoNotification?.();
  } catch {}
}

/* --------------------------- Study plan reminders ------------------------ */

/** Hands the plan list to Android so alarms fire 10 min before each session. */
export function syncStudyPlanReminders(
  plans: {
    id: string;
    subject: string;
    topic?: string;
    time: string;
    durationMinutes: number;
    repeat: string;
    weekday?: number;
    monthday?: number;
  }[],
) {
  try {
    bridge()?.syncStudyPlans?.(JSON.stringify(plans));
    bridge()?.setPlanRemindersEnabled?.(notificationsAllowed());
  } catch {}
}



/* --------------------------- Session progress ---------------------------- */

/** Older installed APKs retain their existing progress notification. */
export function syncVerifiedCountdown(payload: VerifiedCountdownPayload): boolean {
  const b = bridge();
  if (!b?.syncVerifiedCountdown) return false;
  try {
    if (!notificationsAllowed()) b.hideSessionProgress?.();
    else b.syncVerifiedCountdown(JSON.stringify(countdownPayload(payload, Date.now())));
    return true;
  } catch { return false; }
}

export function finishVerifiedCountdown(status: "completed" | "failed") {
  try {
    const b = bridge();
    if (b?.finishVerifiedCountdown) b.finishVerifiedCountdown(status);
    else b?.hideSessionProgress?.();
  } catch {}
}

export function syncStandardCountdown(payload: VerifiedCountdownPayload): boolean {
  const b = bridge();
  if (!b?.syncStandardCountdown) return false;
  try {
    if (!notificationsAllowed()) b.hideSessionProgress?.();
    else b.syncStandardCountdown(JSON.stringify(countdownPayload(payload, Date.now())));
    return true;
  } catch { return false; }
}

export function showSessionProgress(title: string, text: string, progress: number) {
  try {
    if (!notificationsAllowed()) return bridge()?.hideSessionProgress?.();
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

/** Minutes elapsed since local midnight — a hard ceiling for any daily total. */
function minutesSinceMidnight() {
  const now = new Date();
  return Math.max(
    0,
    Math.floor(
      (now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
        60000,
    ),
  );
}

export function readScreenTime(): ScreenTime | null {
  try {
    const raw = bridge()?.screenTimeToday?.();
    if (!raw) return null;
    const data = JSON.parse(raw) as ScreenTime;
    // Defensive clamp: nothing today can exceed the time since 12:00 AM.
    const cap = minutesSinceMidnight();
    const commitxMinutes = Math.min(Math.max(0, data.commitxMinutes ?? 0), cap);
    const otherMinutes = Math.min(
      Math.max(0, data.otherMinutes ?? 0),
      Math.max(0, cap - commitxMinutes),
    );
    return { ...data, commitxMinutes, otherMinutes };
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

/** True inside the native Android shell (false on the web build). */
export function isNativeApp() {
  return Boolean(bridge());
}

/** Opens the Play in-app review flow (falls back to the Play Store listing). */
export function rateApp() {
  try {
    bridge()?.rateApp?.();
  } catch {}
}

const LIMIT_CHANGE_KEY = "commitx-screen-limit-changed-on";

function today() {
  return new Date().toDateString();
}

/** The screen-time limit may only be changed once per day. */
export function canChangeScreenTimeLimit() {
  try {
    return localStorage.getItem(LIMIT_CHANGE_KEY) !== today();
  } catch {
    return true;
  }
}

export function markScreenTimeLimitChanged() {
  try {
    localStorage.setItem(LIMIT_CHANGE_KEY, today());
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

/* --------------------------- Screen time details -------------------------- */

export interface ScreenTimeApp {
  packageName: string;
  label: string;
  minutes: number;
  isCommitX: boolean;
  icon?: string;
}

export interface ScreenTimeDetails {
  supported: boolean;
  granted: boolean;
  totalMinutes: number;
  commitxMinutes: number;
  otherMinutes: number;
  hourly: number[];
  apps: ScreenTimeApp[];
  week: { dayStart: number; minutes: number }[];
}

/** Real per-app usage from Android UsageStatsManager; null outside the Android app. */
export function readScreenTimeDetails(): ScreenTimeDetails | null {
  try {
    const raw = bridge()?.screenTimeDetails?.();
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ScreenTimeDetails>;
    return {
      supported: Boolean(d.supported),
      granted: Boolean(d.granted),
      totalMinutes: d.totalMinutes ?? 0,
      commitxMinutes: d.commitxMinutes ?? 0,
      otherMinutes: d.otherMinutes ?? 0,
      hourly: d.hourly ?? [],
      apps: d.apps ?? [],
      week: d.week ?? [],
    };
  } catch {
    return null;
  }
}
