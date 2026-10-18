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

/** One mandatory halfway break for commitments longer than two hours. */
export const RECOVERY_BREAK_MS = 5 * 60 * 1000;

/**
 * Two-hour (or shorter) commitments finish without interruption. Longer
 * commitments pause once, exactly halfway through their focused time.
 */
export function wellnessBreaksApply(durationMinutes: number) {
  return durationMinutes > 120;
}

export function wellnessBreakAtMs(durationMinutes: number) {
  return (durationMinutes * 60 * 1000) / 2;
}


export interface ActiveVerifiedSession {
  /** Stable outcome id survives reloads and completion retries. */
  id?: string;
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
  /** Zero before the single halfway break, one after it is confirmed. */
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
      JSON.stringify({ ...session, id: session.id ?? (readActiveVerifiedSession()?.startedAt === session.startedAt ? readActiveVerifiedSession()?.id : undefined) ?? createLocalSessionId(), lastLifecycleAt: Date.now() }),
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

/**
 * The still-running session that should be re-entered when the app is opened
 * from the timer notification (or relaunched after being killed). Returns null
 * whenever there is nothing live to restore, so nothing is ever resurrected:
 * a pending failure is handled by the recovery path, an already-ended
 * commitment stays ended, and a stale focus record is ignored.
 */
export function readRestorableActiveSession(): ActiveVerifiedSession | null {
  const active = readActiveVerifiedSession();
  if (!active || active.pendingFail) return null;

  const goal = active.goal;
  const duration = active.duration;
  const value = active.value;
  const mode = active.mode;
  if (typeof goal !== "string" || typeof duration !== "number") return null;
  if (typeof value !== "number" || (mode !== "standard" && mode !== "verified")) return null;
  if (isSessionEnded({ goal, duration, value, mode })) return null;

  const started = typeof active.startedAt === "number" ? active.startedAt : 0;
  if (!started) return null;
  const sinceStart = Date.now() - started;
  if (sinceStart < 0) return null;

  // A break / confirmation phase is generously long-lived (the user may come
  // back much later), but not forever: an abandoned record must never trap the
  // app on an old timer screen on every launch. A focus phase is tighter.
  const phase = active.phase ?? "focus";
  const limit =
    duration * 60 * 1000 + (phase === "focus" ? 3 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000);
  if (sinceStart > limit) {
    // Abandoned: forget it so the app opens normally again.
    clearActiveVerifiedSession();
    return null;
  }

  return active;
}
