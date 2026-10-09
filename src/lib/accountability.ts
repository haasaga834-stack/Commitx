/**
 * Accountability / Roast Mode bridge. The native Android engine decides when a
 * nudge fires (randomized, cooldowns, daily cap, quiet hours) so it works with
 * the app closed. This module only reports commitment events. No-op on the web.
 */
import { useEffect, useState } from "react";
import { getState } from "@/lib/commitx-store";

export type AccountabilityStyle = "gentle" | "sarcastic" | "savage" | "brutal" | "off";
export const ACCOUNTABILITY_STYLES: AccountabilityStyle[] = ["gentle", "sarcastic", "savage", "brutal", "off"];
export const DEFAULT_ACCOUNTABILITY_STYLE: AccountabilityStyle = "sarcastic";
const KEY = "commitx.accountability.style";

type Bridge = {
  setAccountabilityStyle?: (style: string) => void;
  accountabilityDrafted?: (targetMin: number) => void;
  accountabilityStarted?: (targetMin: number, startedAtMs: number) => void;
  accountabilityEnded?: (status: string, targetMin: number, doneMin: number, streak: number, failStreak: number) => void;
  accountabilityAppOpened?: (streak: number, failStreak: number) => void;
};

function bridge(): Bridge | undefined {
  return typeof window === "undefined" ? undefined : (window.CommitXAndroid as Bridge | undefined);
}

function safe(fn: () => void) {
  try {
    fn();
  } catch {}
}

export function getAccountabilityStyle(): AccountabilityStyle {
  if (typeof window === "undefined") return DEFAULT_ACCOUNTABILITY_STYLE;
  const v = window.localStorage.getItem(KEY) as AccountabilityStyle | null;
  return v && ACCOUNTABILITY_STYLES.includes(v) ? v : DEFAULT_ACCOUNTABILITY_STYLE;
}

export function setAccountabilityStyle(style: AccountabilityStyle) {
  safe(() => window.localStorage.setItem(KEY, style));
  safe(() => bridge()?.setAccountabilityStyle?.(style));
  window.dispatchEvent(new Event("commitx-accountability"));
}

export function useAccountabilityStyle() {
  const [style, setStyle] = useState<AccountabilityStyle>(DEFAULT_ACCOUNTABILITY_STYLE);
  useEffect(() => {
    const sync = () => setStyle(getAccountabilityStyle());
    sync();
    window.addEventListener("commitx-accountability", sync);
    return () => window.removeEventListener("commitx-accountability", sync);
  }, []);
  return style;
}

/** Day streak and consecutive most-recent failures from local history. */
export function behaviourSnapshot() {
  const sessions = [...(getState().sessions ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  let failStreak = 0;
  for (const s of sessions) {
    if (s.status !== "failed") break;
    failStreak++;
  }
  const days = new Set(sessions.filter((s) => s.status === "completed").map((s) => new Date(s.date).toDateString()));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { streak, failStreak };
}

export function accountabilityAppOpened() {
  const b = bridge();
  if (!b?.accountabilityAppOpened) return;
  safe(() => b.setAccountabilityStyle?.(getAccountabilityStyle()));
  const { streak, failStreak } = behaviourSnapshot();
  safe(() => b.accountabilityAppOpened!(streak, failStreak));
}

export function accountabilityDrafted(targetMin: number) {
  safe(() => bridge()?.accountabilityDrafted?.(Math.round(targetMin)));
}

export function accountabilityStarted(targetMin: number, startedAt: number) {
  safe(() => bridge()?.accountabilityStarted?.(Math.round(targetMin), startedAt));
}

/** Call after the session result is in local history so streaks are current. */
export function accountabilityEnded(status: "completed" | "failed", targetMin: number, doneMin: number) {
  const b = bridge();
  if (!b?.accountabilityEnded) return;
  // Let local history update first.
  setTimeout(() => {
    const snap = behaviourSnapshot();
    const failStreak = status === "failed" ? Math.max(1, snap.failStreak) : 0;
    safe(() => b.accountabilityEnded!(status, Math.round(targetMin), Math.max(0, Math.round(doneMin)), snap.streak, failStreak));
  }, 1500);
}
