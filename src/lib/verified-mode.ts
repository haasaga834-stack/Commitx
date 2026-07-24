import { planDeduction, setState } from "./commitx-store";
import type { Mode } from "./commitx-store";

export const ACTIVE_VERIFIED_SESSION_KEY = "commitx-active-session-v1";

export type VerifiedFailureReason =
  | "app_switch"
  | "android_user_leave"
  | "home"
  | "recents"
  | "multi_window"
  | "split_screen"
  | "browser_unload"
  | "killed"
  | "quit"
  | string;

export interface ActiveVerifiedSession {
  goal: string;
  duration: number;
  value: number;
  mode: Mode;
  preferReal: boolean | "1" | "0";
  startedAt: number;
  pendingFail?: boolean;
  reason?: VerifiedFailureReason;
  failedAt?: number;
  lastLifecycleAt?: number;
}

export interface VerifiedFailureOutcome {
  goal: string;
  duration: number;
  value: number;
  reason: VerifiedFailureReason;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readActiveVerifiedSession(): ActiveVerifiedSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_VERIFIED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ActiveVerifiedSession;
  } catch {
    return null;
  }
}

export function writeActiveVerifiedSession(session: ActiveVerifiedSession) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      ACTIVE_VERIFIED_SESSION_KEY,
      JSON.stringify({ ...session, lastLifecycleAt: Date.now() }),
    );
  } catch {}
}

export function clearActiveVerifiedSession() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(ACTIVE_VERIFIED_SESSION_KEY);
  } catch {}
}

export function markActiveVerifiedSessionPendingFailure(reason: VerifiedFailureReason) {
  const active = readActiveVerifiedSession();
  if (!active || active.mode !== "verified") return;
  writeActiveVerifiedSession({
    ...active,
    pendingFail: true,
    reason,
    failedAt: Date.now(),
  });
}

export function finalizePendingVerifiedFailure(): VerifiedFailureOutcome | null {
  const active = readActiveVerifiedSession();
  if (!active || active.mode !== "verified" || !active.pendingFail) return null;

  const reason = active.reason || "app_switch";
  clearActiveVerifiedSession();

  setState((state) => {
    const preferReal = active.preferReal === true || active.preferReal === "1";
    const plan = planDeduction(active.value || 0, state.balances, preferReal);
    const demoUsed = plan.ok ? plan.demoUsed : 0;
    const realUsed = plan.ok ? plan.realUsed : 0;

    return {
      ...state,
      sessions: [
        {
          id: `${Date.now()}`,
          goal: active.goal || "Focus",
          durationMinutes: active.duration || 0,
          value: active.value || 0,
          mode: "verified",
          status: "failed",
          date: Date.now(),
          demoUsed,
          realUsed,
        },
        ...state.sessions,
      ],
      balances: {
        demo: Math.max(0, state.balances.demo - demoUsed),
        real: Math.max(0, state.balances.real - realUsed),
      },
    };
  });

  return {
    goal: active.goal || "Focus",
    duration: active.duration || 0,
    value: active.value || 0,
    reason,
  };
}