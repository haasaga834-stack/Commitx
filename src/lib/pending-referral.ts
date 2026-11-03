import { toast } from "sonner";
import { claimReferral } from "@/lib/account.functions";
import { getDeviceHash } from "@/lib/device";
import { supabase } from "@/integrations/supabase/client";
import { codeFromInstallReferrer, normalizeReferralCode } from "@/lib/referral-link";

const KEY = "commitx-pending-referral";

/** Remember a code (typed, from a link or Play install) until a session exists to claim it. */
export function setPendingReferral(code: string) {
  try {
    const clean = normalizeReferralCode(code);
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
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
 * Picks up a referral code from `?ref=` (app opened via a referral link) or,
 * on the first launch after a Play Store install, from the Play Install Referrer.
 */
export function captureReferralFromLaunch() {
  try {
    const url = new URL(window.location.href);
    const fromUrl = normalizeReferralCode(url.searchParams.get("ref"));
    if (fromUrl) {
      setPendingReferral(fromUrl);
      url.searchParams.delete("ref");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      return;
    }
    const native = (window as unknown as { CommitXAndroid?: { takeInstallReferrer?: () => string } }).CommitXAndroid;
    const fromInstall = codeFromInstallReferrer(native?.takeInstallReferrer?.() ?? null);
    if (fromInstall && !getPendingReferral()) setPendingReferral(fromInstall);
  } catch {}
}

/**
 * Applies a pending code as soon as the user is signed in. The database decides
 * whether the account may still claim (new accounts only, once).
 */
export async function claimPendingReferral() {
  const code = getPendingReferral();
  if (!code) return;
  clearPendingReferral();
  try {
    const res = await claimReferral({ data: { code, deviceHash: getDeviceHash() } });
    if (res.ok) toast.success(res.message);
  } catch {}
}

/** Tells a referrer about friends who joined since they last opened the app. */
export async function announceNewReferrals() {
  try {
    const { data } = await supabase.rpc("take_unseen_referrals");
    const n = typeof data === "number" ? data : 0;
    if (n === 1) toast.success("Congratulations! Your friend joined CommitX using your referral code. You earned 50 CX Coins!");
    else if (n > 1) toast.success(`Congratulations! ${n} friends joined CommitX using your referral code. You earned ${n * 50} CX Coins!`);
  } catch {}
}
