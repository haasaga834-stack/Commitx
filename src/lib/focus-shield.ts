/**
 * Focus Shield — optional distraction blocking for Standard sessions.
 *
 * The actual app restriction is enforced by the native Android layer
 * (FocusShieldService + FocusShieldActivity). This module is only a thin,
 * honest wrapper: every call is a no-op on the web, and `shieldActive()` only
 * ever reports true when the native layer confirms protection is running.
 *
 * Verified Mode never touches any of this.
 */
import { supabase } from "@/integrations/supabase/client";
import { hasNativeBridge } from "./native-session";

export interface ShieldAppOption {
  /** Android package name. */
  pkg: string;
  /** Display name, e.g. "Instagram". */
  label: string;
  /** Base64 PNG data URL of the launcher icon, when the native layer supplies it. */
  icon?: string;
}

/** Groups shown in the picker. A group is offered when any package is installed. */
export interface ShieldGroup {
  id: string;
  label: string;
  packages: string[];
}

/** Package names for each blockable app group (used verbatim by the native layer). */
export const FOCUS_SHIELD_GROUPS: ShieldGroup[] = [
  { id: "instagram", label: "Instagram", packages: ["com.instagram.android"] },
  { id: "youtube", label: "YouTube", packages: ["com.google.android.youtube"] },
  { id: "facebook", label: "Facebook", packages: ["com.facebook.katana"] },
  { id: "whatsapp", label: "WhatsApp", packages: ["com.whatsapp"] },
  { id: "messenger", label: "Messenger", packages: ["com.facebook.orca"] },
  { id: "reddit", label: "Reddit", packages: ["com.reddit.frontpage"] },
  { id: "x", label: "X", packages: ["com.twitter.android"] },
  { id: "snapchat", label: "Snapchat", packages: ["com.snapchat.android"] },
  { id: "chrome", label: "Chrome", packages: ["com.android.chrome"] },
  {
    id: "games",
    label: "Games",
    packages: [
      "com.dts.freefireth",
      "com.dts.freefiremax",
      "com.pubg.imobile",
      "com.tencent.ig",
      "com.activision.callofduty.shooter",
      "com.supercell.clashofclans",
      "com.supercell.clashroyale",
      "com.supercell.brawlstars",
      "com.mojang.minecraftpe",
      "com.roblox.client",
      "com.king.candycrushsaga",
      "com.ea.gp.fifamobile",
    ],
  },
];

export type ShieldStatus = "off" | "active" | "unavailable" | "ended";

interface Bridge {
  focusShieldSupported?: () => boolean;
  focusShieldHasUsageAccess?: () => boolean;
  focusShieldHasOverlayAccess?: () => boolean;
  requestFocusShieldOverlayAccess?: () => void;
  focusShieldApps?: () => string;
  focusShieldStart?: (packagesJson: string, endsAtMs: number) => boolean;
  focusShieldStop?: () => void;
  focusShieldActive?: () => boolean;
}

function bridge(): Bridge | null {
  if (!hasNativeBridge()) return null;
  return (window.CommitXAndroid as unknown as Bridge) ?? null;
}

/** True only in the Android app, on a platform where blocking is supported. */
export function shieldSupported() {
  try {
    return Boolean(bridge()?.focusShieldSupported?.());
  } catch {
    return false;
  }
}

export function shieldHasUsageAccess() {
  try {
    return Boolean(bridge()?.focusShieldHasUsageAccess?.());
  } catch {
    return false;
  }
}

export function shieldHasOverlayAccess() {
  try {
    return Boolean(bridge()?.focusShieldHasOverlayAccess?.());
  } catch {
    return false;
  }
}

export function requestShieldOverlayAccess() {
  try {
    bridge()?.requestFocusShieldOverlayAccess?.();
  } catch {}
}

export function openUsageAccess() {
  try {
    window.CommitXAndroid?.openUsageAccessSettings?.();
  } catch {}
}

/** Installed, blockable apps as reported by Android. Empty on the web. */
export function shieldApps(): ShieldAppOption[] {
  try {
    const raw = bridge()?.focusShieldApps?.();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShieldAppOption[];
    return Array.isArray(parsed) ? parsed.filter((a) => a && a.pkg) : [];
  } catch {
    return [];
  }
}

/**
 * Asks the native layer to start protection. Returns true only when Android
 * confirms the shield is running — never optimistically.
 */
export function startShield(packages: string[], endsAtMs: number) {
  if (!packages.length) return false;
  try {
    return Boolean(bridge()?.focusShieldStart?.(JSON.stringify(packages), endsAtMs));
  } catch {
    return false;
  }
}

/** Restores normal app access. Safe to call repeatedly. */
export function stopShield() {
  try {
    bridge()?.focusShieldStop?.();
  } catch {}
}

/** Live native confirmation that protection is currently enforced. */
export function shieldActive() {
  try {
    return Boolean(bridge()?.focusShieldActive?.());
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Handover between /commit and /session                               */
/* ------------------------------------------------------------------ */

export interface ShieldPlan {
  enabled: boolean;
  packages: string[];
  labels: string[];
}

const KEY = "commitx-focus-shield-plan";

export function writeShieldPlan(plan: ShieldPlan) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
  } catch {}
}

export function readShieldPlan(): ShieldPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShieldPlan;
    if (!parsed || !Array.isArray(parsed.packages)) return null;
    return {
      enabled: Boolean(parsed.enabled),
      packages: parsed.packages.filter((p) => typeof p === "string"),
      labels: Array.isArray(parsed.labels) ? parsed.labels : [],
    };
  } catch {
    return null;
  }
}

export function clearShieldPlan() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Session record                                                      */
/* ------------------------------------------------------------------ */

/** Mirrors the shield state onto the user's live session row. Best effort. */
export async function recordShieldState(input: {
  enabled: boolean;
  status: ShieldStatus;
  packages: string[];
  startedAt?: number | null;
  endsAt?: number | null;
}) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    await supabase
      .from("active_sessions")
      .update({
        focus_shield_enabled: input.enabled,
        focus_shield_status: input.status,
        focus_shield_packages: input.packages,
        focus_shield_started_at: input.startedAt ? new Date(input.startedAt).toISOString() : null,
        focus_shield_ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
      } as never)
      .eq("user_id", userId);
  } catch {}
}
