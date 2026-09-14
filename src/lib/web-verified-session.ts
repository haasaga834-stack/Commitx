import { supabase } from "@/integrations/supabase/client";
import { isOnline } from "./connectivity";
import { hasNativeBridge } from "./native-session";

/**
 * WEB-ONLY Verified Session enforcement helpers.
 *
 * The Android APK keeps its existing native behaviour untouched: every helper
 * here is a no-op whenever the native bridge is present.
 */
export function isWebRuntime() {
  return typeof window !== "undefined" && !hasNativeBridge();
}

export const WEB_HEARTBEAT_MS = 7_000;

/** sessionStorage marker used to detect a reload of a live verified session. */
const RELOAD_KEY = "commitx-web-verified-live-v1";

/**
 * Returns true when this verified session page is being *re-entered* (refresh,
 * reload, restored tab) rather than freshly started from /commit.
 */
export function claimWebSessionTab(startedAt: number): { reloaded: boolean } {
  if (typeof window === "undefined") return { reloaded: false };
  try {
    const prev = window.sessionStorage.getItem(RELOAD_KEY);
    if (prev && prev === String(startedAt)) return { reloaded: true };
    window.sessionStorage.setItem(RELOAD_KEY, String(startedAt));
    return { reloaded: false };
  } catch {
    return { reloaded: false };
  }
}

export function clearWebSessionTab() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RELOAD_KEY);
  } catch {}
}

export type HeartbeatStatus = "active" | "failed" | "none" | "unknown";

async function hasAuthenticatedSession() {
  const { data, error } = await supabase.auth.getSession();
  return !error && Boolean(data.session?.access_token);
}

/** Refreshes backend liveness; returns the authoritative session status. */
export async function heartbeatWebSession(): Promise<HeartbeatStatus> {
  if (!isOnline()) return "unknown";
  try {
    if (!(await hasAuthenticatedSession())) return "none";
    const { data, error } = await supabase.rpc("web_session_heartbeat");
    if (error) return "unknown";
    const status = typeof data === "string" ? data : "unknown";
    if (status === "active" || status === "failed" || status === "none") return status;
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Keeps a deliberately paused web session alive without running the strict
 * timeout check first. RLS limits this update to the signed-in user's row.
 */
export async function touchPausedWebSession(): Promise<HeartbeatStatus> {
  if (!isOnline()) return "unknown";
  try {
    if (!(await hasAuthenticatedSession())) return "none";
    const { data, error } = await supabase.rpc("touch_paused_web_session");
    if (error) return "unknown";
    const status = typeof data === "string" ? data : "unknown";
    if (status === "active" || status === "failed" || status === "none") return status;
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Atomically marks the user's active session as failed (idempotent). */
export async function failWebSession(reason: string): Promise<void> {
  if (!isOnline()) return;
  try {
    if (!(await hasAuthenticatedSession())) return;
    await supabase.rpc("fail_web_session", { _reason: reason });
  } catch {}
}

/** Best-effort synchronous-ish failure signal for unload paths. */
export function failWebSessionBeacon(reason: string) {
  void failWebSession(reason);
}

/** Releases the slot only while the session is still active. */
export async function finishWebSession(): Promise<boolean> {
  if (!isOnline()) return true;
  try {
    if (!(await hasAuthenticatedSession())) return true;
    const { data, error } = await supabase.rpc("finish_web_session");
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
