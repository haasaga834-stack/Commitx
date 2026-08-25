import { createLocalSessionId, setState } from "./commitx-store";
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

/** Persisted session phase — timestamps remain the source of truth. */
export type SessionPhase = "focus" | "recovery_break" | "awaiting_confirmation";

/** Mandatory wellness break cadence & windows. */
export const FOCUS_HOUR_MS = 60 * 60 * 1000;
export const RECOVERY_BREAK_MS = 5 * 60 * 1000;
/** Grace period to tap "Continue Session" once the break has finished. */
export const RECOVERY_CONFIRM_MS = 60 * 1000;

/**
 * Wellness breaks only apply to sessions longer than one hour. A 60-minute
 * (or shorter) commitment finishes without ever being interrupted.
 */
export function wellnessBreaksApply(durationMinutes: number) {
  return durationMinutes > 60;
}


export interface ActiveVerifiedSession {
  goal: string;
  duration: number;
  value: number;
  mode: Mode;
  startedAt: number;
  pendingFail?: boolean;
  reason?: VerifiedFailureReason;
  failedAt?: number;
  lastLifecycleAt?: number;
  /** Study time already banked (excludes paused/background time). */
  accumulatedMs?: number;
  /** Timestamp the timer last started running, or null while paused. */
  runningSince?: number | null;
  /** Session phase: focus / recovery break / awaiting confirmation. */
  phase?: SessionPhase;
  /** Wall-clock timestamp the current recovery break started. */
  breakStartedAt?: number | null;
  /** Wall-clock timestamp the confirmation window opened. */
  confirmSince?: number | null;
  /** How many recovery breaks have been completed & confirmed. */
  breaksTaken?: number;
  /** Total wall-clock time spent outside focus (breaks + confirmation). */
  nonFocusMs?: number;
  /** Visual ambience theme chosen before the session started. */
  theme?: string;
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
    const coinsSpent = Math.min(active.value || 0, state.coins);

    return {
      ...state,
      sessions: [
        {
          id: createLocalSessionId(),
          goal: active.goal || "Focus",
          durationMinutes: active.duration || 0,
          value: active.value || 0,
          mode: "verified",
          status: "failed",
          date: Date.now(),
          coinsSpent,
        },
        ...state.sessions,
      ],
      coins: Math.max(0, state.coins - coinsSpent),
    };
  });

  return {
    goal: active.goal || "Focus",
    duration: active.duration || 0,
    value: active.value || 0,
    reason,
  };
}
/* ------------------------------------------------------------------ */
/* Ended-session marker                                                */
/* ------------------------------------------------------------------ */

export const ENDED_SESSION_KEY = "commitx-session-ended-v1";

export interface EndedSessionMarker {
  goal: string;
  duration: number;
  value: number;
  mode: Mode;
  status: "completed" | "failed";
  reason?: VerifiedFailureReason;
  endedAt: number;
}

/**
 * Records that a session has definitively ended, so reopening the timer screen
 * (back gesture, refresh, app restart) can never resurrect a dead timer.
 */
export function markSessionEnded(marker: Omit<EndedSessionMarker, "endedAt">) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      ENDED_SESSION_KEY,
      JSON.stringify({ ...marker, endedAt: Date.now() }),
    );
  } catch {}
}

export function readEndedSession(): EndedSessionMarker | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(ENDED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as EndedSessionMarker;
  } catch {
    return null;
  }
}

export function clearEndedSession() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(ENDED_SESSION_KEY);
  } catch {}
}

/** True when this exact commitment was already ended. */
export function isSessionEnded(input: {
  goal: string;
  duration: number;
  value: number;
  mode: Mode;
}) {
  const m = readEndedSession();
  if (!m) return false;
  return (
    m.goal === input.goal &&
    m.duration === input.duration &&
    m.value === input.value &&
    m.mode === input.mode
  );
}
