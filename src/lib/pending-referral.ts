import { claimReferral } from "@/lib/account.functions";
import { getDeviceHash } from "@/lib/device";

const KEY = "commitx-pending-referral";

/** Remember a code typed during sign-up until a session exists to claim it. */
export function setPendingReferral(code: string) {
  try {
    const clean = code.trim().toUpperCase();
    if (clean) localStorage.setItem(KEY, clean);
  } catch {}
}

export function getPendingReferral(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferral() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/**
 * Applies a code entered on the sign-up screen as soon as the user is signed in.
 * Safe to call on every auth state change — it clears itself after one attempt.
 */
export async function claimPendingReferral() {
  const code = getPendingReferral();
  if (!code) return;
  clearPendingReferral();
  try {
    await claimReferral({ data: { code, deviceHash: getDeviceHash() } });
  } catch {}
}
