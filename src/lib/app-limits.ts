/**
 * App Usage Limits — daily per-app limits tracked and enforced by the native
 * Android layer (AppLimitsStore + AppLimitsService). Independent of Focus
 * Shield; every call is a no-op on the web.
 */
import { hasNativeBridge } from "./native-session";

export interface AppLimit {
  pkg: string;
  label: string;
  type: "time" | "reels";
  /** Daily limit in minutes (reels limits are stored already converted). */
  minutes: number;
  usedMinutes: number;
}

export const TIME_LIMIT_OPTIONS = [30, 45, 60, 90, 120];
export const REELS_LIMIT_OPTIONS = [30, 50, 100, 150, 200];

/** Reels/Shorts limits only make sense for Instagram and YouTube. */
const REELS_PACKAGES = new Set(["com.instagram.android", "com.google.android.youtube"]);

export function reelsSupported(pkg: string) {
  return REELS_PACKAGES.has(pkg);
}

/** Estimated minutes for a number of Reels/Shorts (~30 seconds each). */
export function reelsToMinutes(reels: number) {
  return Math.round(reels * 0.5);
}

interface Bridge {
  appLimitsSupported?: () => boolean;
  appLimitsJson?: () => string;
  setAppLimit?: (pkg: string, type: string, minutes: number) => void;
  removeAppLimit?: (pkg: string) => void;
}

function bridge(): Bridge | null {
  if (!hasNativeBridge()) return null;
  return (window.CommitXAndroid as unknown as Bridge) ?? null;
}

/** True only when usage access and overlay permission are both granted. */
export function appLimitsReady() {
  try {
    return Boolean(bridge()?.appLimitsSupported?.());
  } catch {
    return false;
  }
}

export function appLimitsAvailable() {
  return hasNativeBridge();
}

export function readAppLimits(): AppLimit[] {
  try {
    const raw = bridge()?.appLimitsJson?.();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppLimit[];
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.pkg && l.minutes > 0) : [];
  } catch {
    return [];
  }
}

export function setAppLimit(pkg: string, type: "time" | "reels", minutes: number) {
  try {
    bridge()?.setAppLimit?.(pkg, type, minutes);
  } catch {}
}

export function removeAppLimit(pkg: string) {
  try {
    bridge()?.removeAppLimit?.(pkg);
  } catch {}
}
