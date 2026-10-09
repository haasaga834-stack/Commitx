import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hourglass } from "@/components/Hourglass";
import { BreakIllustration } from "@/components/BreakIllustration";
import { Button } from "@/components/ui/button";
import { SessionScene } from "@/components/SessionScene";
import { setState, coinLabel, coinsForMinutes, createLocalSessionId, getState, type Mode } from "@/lib/commitx-store";
import {
  clearActiveVerifiedSession,
  finalizePendingVerifiedFailure,
  markActiveVerifiedSessionPendingFailure,
  markSessionEnded,
  isSessionEnded,
  readActiveVerifiedSession,
  readEndedSession,
  readRestorableActiveSession,
  writeActiveVerifiedSession,
  RECOVERY_BREAK_MS,
  wellnessBreakAtMs,
  wellnessBreaksApply,
  type SessionPhase,
  type VerifiedFailureReason,
} from "@/lib/verified-mode";
import { releaseActiveDbSession } from "@/lib/active-session";
import {
  claimWebSessionTab,
  clearWebSessionTab,
  failWebSession,
  failWebSessionBeacon,
  heartbeatWebSession,
  isWebRuntime,
  touchPausedWebSession,
  WEB_HEARTBEAT_MS,
} from "@/lib/web-verified-session";
import { normalizeTheme, type SessionThemeId } from "@/lib/session-themes";

import {
  announceWellnessBreak,
  announceBreakOver,
  cancelWellnessSounds,
  scheduleWellnessSound,
} from "@/lib/wellness-chime";


import {
  canCheckDnd,
  isDndEnabled,
  openDndSettings,
  setNativeSessionLock,
  setNativeVerifiedModeActive,
} from "@/lib/native-session";
import { BellOff, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  clearShieldPlan,
  readShieldPlan,
  recordShieldState,
  shieldActive,
  startShield,
  stopShield,
} from "@/lib/focus-shield";


import { showSessionProgress, hideSessionProgress } from "@/lib/native-notifications";
import { isOnline } from "@/lib/connectivity";
import { z } from "zod";
import { useAuth } from "@/lib/use-auth";
import { recordSessions } from "@/lib/wallet.functions";
import { markSessionSynced } from "@/lib/cloud-sync";

declare global {
  interface Window {
    CommitXVerifiedMode?: {
      onAndroidUserLeaveHint?: (reason?: VerifiedFailureReason) => void;
      onAndroidMultiWindow?: () => void;
      fail?: (reason?: VerifiedFailureReason) => void;
    };
  }
}

const search = z.object({
  goal: z.string().default("Focus"),
  duration: z.coerce.number().min(1).default(30),
  value: z.coerce.number().min(0).default(10),
  mode: z.enum(["standard", "verified"]).default("standard"),
  theme: z.string().optional(),
});

export const Route = createFileRoute("/session")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "CommitX — Active session" },
      { name: "description", content: "Stay with your promise." },
      { property: "og:title", content: "CommitX — Active session" },
      { property: "og:description", content: "Stay with your promise." },
    ],
  }),
  component: Session,
});

/** Emergency call / brief absence allowance for Verified sessions. */
const VERIFIED_GRACE_MS = 60_000;

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

const QUOTES = [
  "One promise at a time.",
  "Stillness is a skill.",
  "Small acts, kept.",
  "Presence over pressure.",
];

function log(evt: string, extra?: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.log(`[CommitX lifecycle] ${evt}`, extra ?? "");
}


function eventReason(event: Event, fallback: VerifiedFailureReason) {
  if (event instanceof CustomEvent && event.detail && typeof event.detail.reason === "string") {
    return event.detail.reason;
  }
  return fallback;
}

/**
 * Gate in front of the live timer. A session may only run while a valid active
 * ticket exists (written by /commit before navigating) and while this exact
 * commitment has not already been ended. So a back gesture from the result
 * screen, a refresh or an app restart can never resurrect a dead timer.
 */
function Session() {
  const { goal, duration, value, mode } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "live" | "dead">("checking");

  useEffect(() => {
    const ticket = readActiveVerifiedSession();
    const valid =
      !isSessionEnded({ goal, duration, value, mode }) &&
      !!ticket &&
      !ticket.pendingFail &&
      ticket.goal === goal &&
      ticket.duration === duration &&
      ticket.value === value &&
      ticket.mode === mode;
    if (valid) {
      setStatus("live");
      return;
    }

    /**
     * A Verified session that already failed by the existing rules stays
     * failed. Arriving here from the timer notification must never revive it or
     * quietly drop it: the recorded outcome is settled once and shown.
     */
    if (ticket?.mode === "verified" && ticket.pendingFail) {
      setStatus("dead");
      setNativeSessionLock(false);
      setNativeVerifiedModeActive(false);
      hideSessionProgress();
      const failure = finalizePendingVerifiedFailure();
      if (failure) {
        markSessionEnded({
          goal: failure.goal,
          duration: failure.duration,
          value: failure.value,
          mode: "verified",
          status: "failed",
          reason: failure.reason,
        });
        void releaseActiveDbSession();
        navigate({
          to: "/failed",
          search: {
            goal: String(failure.goal),
            duration: String(failure.duration),
            value: String(failure.value),
            reason: failure.reason,
          } as Record<string, string>,
          replace: true,
        });
        return;
      }
      // Already settled elsewhere (root recovery) — go to the result screen.
      navigate({ to: "/failed", search: { goal, duration: String(duration), value: String(value) } as Record<string, string>, replace: true });
      return;
    }

    /**
     * Opened without (or with the wrong) commitment details — this happens when
     * the timer notification launches the app straight at the timer screen. A
     * still-running session must be re-entered, never silently discarded.
     */
    const live = readRestorableActiveSession();
    if (
      live &&
      (live.goal !== goal ||
        live.duration !== duration ||
        live.value !== value ||
        live.mode !== mode)
    ) {
      navigate({
        to: "/session",
        search: {
          goal: live.goal,
          duration: live.duration,
          value: live.value,
          mode: live.mode,
          ...(live.theme ? { theme: live.theme } : {}),
        },
        replace: true,
      });
      return;
    }

    setStatus("dead");
    setNativeSessionLock(false);
    setNativeVerifiedModeActive(false);
    hideSessionProgress();
    stopShield();
    clearShieldPlan();

    void releaseActiveDbSession();

    /**
     * This commitment was already settled (for example a Verified web session
     * failed on reload and root recovery cleared the ticket). The recorded
     * outcome must be shown instead of silently dropping the user home.
     */
    const ended = readEndedSession();
    if (
      ended &&
      ended.goal === goal &&
      ended.duration === duration &&
      ended.value === value &&
      ended.mode === mode
    ) {
      navigate({
        to: ended.status === "completed" ? "/success" : "/failed",
        search: {
          goal,
          duration: String(duration),
          value: String(value),
          ...(ended.reason ? { reason: ended.reason } : {}),
        } as Record<string, string>,
        replace: true,
      });
      return;
    }

    navigate({ to: "/", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, duration, value, mode]);


  if (status !== "live") return null;
  return <LiveSession />;
}

function LiveSession() {
  const { goal, duration, value, mode, theme } = Route.useSearch();
  // Guests can run a full session; nothing is staked, stored or synced.
  const { user, loading: authLoading } = useAuth();
  const guestRef = useRef(false);
  guestRef.current = !authLoading && !user;
  const navigate = useNavigate();
  const totalMs = duration * 60 * 1000;
  // Sessions longer than two hours pause once, exactly halfway through focus.
  const breaksApply = wellnessBreaksApply(duration);
  const halfwayMs = wellnessBreakAtMs(duration);
  const isVerified = mode === "verified";

  /**
   * Focus Shield — Standard sessions only. Protection is enforced natively on
   * Android; `shieldOn` is only true while the native layer confirms it, so the
   * badge never claims blocking that isn't actually happening. Losing the shield
   * never fails the session.
   */
  const [shieldOn, setShieldOn] = useState(false);
  useEffect(() => {
    if (isVerified) return;
    const plan = readShieldPlan();
    clearShieldPlan();
    if (!plan?.enabled || !plan.packages.length) return;

    const endsAt = Date.now() + duration * 60 * 1000;
    const ok = startShield(plan.packages, endsAt);
    const live = ok && shieldActive();
    setShieldOn(live);
    if (!guestRef.current) {
      void recordShieldState({
        enabled: true,
        status: live ? "active" : "unavailable",
        packages: plan.packages,
        startedAt: live ? Date.now() : null,
        endsAt: live ? endsAt : null,
      });
    }
    if (!live) return;

    // Keep the badge honest if Android stops protection for any reason.
    const id = window.setInterval(() => setShieldOn(shieldActive()), 5000);
    return () => {
      window.clearInterval(id);
      stopShield();
      if (!guestRef.current) {
        void recordShieldState({
          enabled: true,
          status: "ended",
          packages: plan.packages,
          startedAt: null,
          endsAt: null,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // Verified sessions require Do Not Disturb before the timer may start.
  const [dndBlocked, setDndBlocked] = useState<boolean>(() => {
    if (typeof window === "undefined" || !isVerified) return false;
    return canCheckDnd() && isDndEnabled() === false;
  });

  // Only a *live* session for the exact same commitment may be restored. A
  // stale record (older than 6h of wall clock, already past its duration, or
  // flagged as failed) is ignored so a new session can never inherit elapsed
  // time and complete itself the moment it starts.
  const restored = useRef(
    typeof window === "undefined"
      ? null
      : (() => {
          const prev = readActiveVerifiedSession();
          if (
            !prev ||
            prev.goal !== goal ||
            prev.duration !== duration ||
            prev.value !== value ||
            prev.mode !== mode ||
            prev.pendingFail
          ) {
            return null;
          }
          const started = typeof prev.startedAt === "number" ? prev.startedAt : 0;
          const sinceStart = Date.now() - started;
          if (!started || sinceStart < 0) return null;
          // A focus phase has a bounded lifetime. Break confirmation is
          // intentionally unbounded, so it must remain restorable until YES.
          if (
            (prev.phase ?? "focus") === "focus" &&
            sinceStart > duration * 60 * 1000 + 3 * 60 * 60 * 1000
          ) return null;
          const banked =
            (prev.accumulatedMs ?? 0) +
            (prev.runningSince ? Math.max(0, Date.now() - prev.runningSince) : 0);
          // Never restore something that would instantly finish.
          if ((prev.phase ?? "focus") === "focus" && banked >= duration * 60 * 1000) return null;
          return prev;
        })(),
  ).current;

  // Theme is fixed for the whole session: search param first, then the ticket.
  const sessionTheme = useRef<SessionThemeId>(
    normalizeTheme(theme ?? restored?.theme),
  ).current;

  const startedAt = useRef<number>(restored?.startedAt ?? Date.now()).current;
  const wellnessSessionKey = useRef(`session_${startedAt}`).current;
  const accumulatedRef = useRef<number>(restored?.accumulatedMs ?? 0);
  const runningSinceRef = useRef<number | null>(
    restored ? (restored.runningSince ?? null) : Date.now(),
  );

  // ---- Recovery-break state (timestamp authoritative, persisted) ----
  const restoredPhase: SessionPhase = restored?.phase ?? "focus";
  const [phase, setPhaseState] = useState<SessionPhase>(restoredPhase);
  const phaseRef = useRef<SessionPhase>(restoredPhase);
  const breakStartedAtRef = useRef<number | null>(restored?.breakStartedAt ?? null);
  const confirmSinceRef = useRef<number | null>(restored?.confirmSince ?? null);
  const breaksTakenRef = useRef<number>(restored?.breaksTaken ?? 0);
  const nonFocusMsRef = useRef<number>(restored?.nonFocusMs ?? 0);
  const setPhase = useCallback((next: SessionPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const [now, setNow] = useState<number>(() => Date.now());
  const [, setPaused] = useState<boolean>(() => runningSinceRef.current === null);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const doneRef = useRef(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  /** Web verified: timestamp the page went away (screen off, tab switch). */
  const awayAtRef = useRef<number | null>(null);
  /** Explicit window blur is the web signal for switching tabs/apps. */
  const webBlurAtRef = useRef<number | null>(null);
  /**
   * Reload protection is claimed once per mounted session. The enforcement
   * effect re-runs whenever the DND check resolves, and a re-run must never be
   * mistaken for a page reload.
   */
  const webClaimedRef = useRef<number | null>(null);


  const persist = useCallback(() => {
    writeActiveVerifiedSession({
      goal,
      duration,
      value,
      mode,
      startedAt,
      accumulatedMs: accumulatedRef.current,
      runningSince: runningSinceRef.current,
      phase: phaseRef.current,
      breakStartedAt: breakStartedAtRef.current,
      confirmSince: confirmSinceRef.current,
      breaksTaken: breaksTakenRef.current,
      nonFocusMs: nonFocusMsRef.current,
      theme: sessionTheme,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, duration, value, mode, startedAt, sessionTheme]);

  /** Wall-clock time spent outside focus (recovery breaks + confirmations). */
  const nonFocusTotal = useCallback(() => {
    const anchor = breakStartedAtRef.current;
    const live = phaseRef.current !== "focus" && anchor ? Math.max(0, Date.now() - anchor) : 0;
    return nonFocusMsRef.current + live;
  }, []);

  const elapsedNow = useCallback(() => {
    const running = runningSinceRef.current;
    const banked = accumulatedRef.current + (running ? Date.now() - running : 0);
    // Verified sessions are anchored to the wall clock: banked focus time can
    // never exceed real time since start minus recovery-break time, so
    // re-renders, backgrounding or restored state can't shorten the commitment.
    if (isVerified) {
      return Math.max(0, Math.min(banked, Date.now() - startedAt - nonFocusTotal()));
    }
    return Math.max(0, banked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, startedAt, nonFocusTotal]);

  /**
   * Authoritative completion gate. A session may only finish once the full
   * committed duration has genuinely elapsed; Verified sessions additionally
   * require the wall clock since start (minus breaks) to have passed, which
   * makes early or duplicate completion impossible.
   */
  const canCompleteNow = useCallback(() => {
    if (phaseRef.current !== "focus") return false;
    if (elapsedNow() < totalMs) return false;
    if (isVerified && Date.now() - startedAt - nonFocusTotal() < totalMs) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedNow, totalMs, isVerified, startedAt, nonFocusTotal]);


  const pauseTimer = useCallback(
    (reason: string) => {
      if (doneRef.current || runningSinceRef.current === null) return;
      accumulatedRef.current = elapsedNow();
      runningSinceRef.current = null;
      persist();
      setPaused(true);
      setNow(Date.now());
      log("Timer Paused", { reason });
    },
    [elapsedNow, persist],
  );

  const resumeTimer = useCallback(
    (reason: string) => {
      if (doneRef.current || runningSinceRef.current !== null) return;
      runningSinceRef.current = Date.now();
      persist();
      setPaused(false);
      setNow(Date.now());
      log("Timer Resumed", { reason });
    },
    [persist],
  );

  /** Begin the mandatory 5-minute recovery break (main timer pauses). */
  const startRecoveryBreak = useCallback(
    (at: number) => {
      if (doneRef.current || phaseRef.current !== "focus") return;
      // Bank exactly the halfway boundary so suspended frames cannot add focus.
      accumulatedRef.current = halfwayMs;
      runningSinceRef.current = null;
      setPaused(true);
      breakStartedAtRef.current = at;
      confirmSinceRef.current = null;
      setPhase("recovery_break");
      if (isVerified) setNativeVerifiedModeActive(false);
      if (isVerified && isWebRuntime()) void touchPausedWebSession();
      persist();
      setNow(Date.now());
      announceWellnessBreak(`${wellnessSessionKey}_break_${breaksTakenRef.current}_start`);
      log("Wellness Break Started", { at, breaksTaken: breaksTakenRef.current });
    },
    [halfwayMs, isVerified, persist, setPhase, wellnessSessionKey],
  );

  const enterAwaitingConfirmation = useCallback(
    (at: number) => {
      if (doneRef.current || phaseRef.current !== "recovery_break") return;
      confirmSinceRef.current = at;
      setPhase("awaiting_confirmation");
      persist();
      setNow(Date.now());
      announceBreakOver(`${wellnessSessionKey}_break_${breaksTakenRef.current}_end`);
      log("Wellness Break Finished", { confirmSince: at });
    },
    [persist, setPhase, wellnessSessionKey],
  );

  const confirmRefreshed = useCallback(async () => {
    if (doneRef.current || phaseRef.current !== "awaiting_confirmation") return;
    if (isVerified && isWebRuntime()) {
      // Refresh with the server clock before focus resumes. Unlike the strict
      // heartbeat, this never interprets an intentionally long break as loss.
      const status = await touchPausedWebSession();
      if (status === "failed") return;
    }
    const anchor = breakStartedAtRef.current;
    if (anchor) nonFocusMsRef.current += Math.max(0, Date.now() - anchor);
    breakStartedAtRef.current = null;
    confirmSinceRef.current = null;
    breaksTakenRef.current += 1;
    if (isVerified && isWebRuntime()) void touchPausedWebSession();
    if (isVerified) setNativeVerifiedModeActive(true);
    setPhase("focus");
    resumeTimer("recovery_confirmed");
    persist();
    log("Recovery Confirmed", { breaksTaken: breaksTakenRef.current });
  }, [isVerified, persist, resumeTimer, setPhase]);

  /**
   * Single timestamp-driven state machine. Every tick, foreground return and
   * lifecycle event routes through here, so exactly one completion trigger and
   * one failure trigger exist.
   */
  const evaluate = useCallback(() => {
    if (doneRef.current) return;
    const t = Date.now();
    if (phaseRef.current === "focus") {
      if (dndBlocked) return;
      if (canCompleteNow()) {
        complete("completed");
        return;
      }
      if (!breaksApply) return;
      const elapsed = elapsedNow();
      if (breaksTakenRef.current === 0 && elapsed >= halfwayMs && elapsed < totalMs) {
        startRecoveryBreak(t - (elapsed - halfwayMs));
      }
      return;
    }
    if (phaseRef.current === "recovery_break") {
      const anchor = breakStartedAtRef.current ?? t;
      if (t - anchor >= RECOVERY_BREAK_MS) {
        enterAwaitingConfirmation(anchor + RECOVERY_BREAK_MS);
      }
      return;
    }
    // awaiting_confirmation is intentionally persistent. Focus remains frozen
    // for as long as needed and resumes only from the explicit YES action.

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dndBlocked,
    breaksApply,
    canCompleteNow,
    elapsedNow,
    totalMs,
    startRecoveryBreak,
    enterAwaitingConfirmation,
    halfwayMs,
  ]);

  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  // Keep the stored session in sync from the very first render.
  useEffect(() => {
    if (dndBlocked) {
      pauseTimer("dnd_required");
      return;
    }
    persist();
    evaluateRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll DND while blocked so returning from settings unblocks automatically.
  useEffect(() => {
    if (!dndBlocked) return;
    const id = setInterval(() => {
      if (isDndEnabled() !== false) {
        setDndBlocked(false);
        if (phaseRef.current === "focus") resumeTimer("dnd_enabled");
      }
    }, 1200);
    return () => clearInterval(id);
  }, [dndBlocked, resumeTimer]);

  // Single animation loop — guards against duplicate timers via doneRef.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      evaluateRef.current();
      if (doneRef.current) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Sessions may only be ended through the in-session End Session flow:
  // every system back action opens the confirmation dialog instead.
  useEffect(() => {
    setNativeSessionLock(true);

    const pushLock = () => {
      try {
        window.history.pushState({ commitxSessionLock: Date.now() }, "");
      } catch {}
    };
    pushLock();

    const askToLeave = () => {
      if (doneRef.current) return;
      setConfirmQuit(true);
      log("Back Intercepted");
    };

    const onPopState = () => {
      if (doneRef.current) return;
      pushLock();
      askToLeave();
    };

    const previousSessionBridge = window.CommitXSession;
    window.CommitXSession = { ...previousSessionBridge, onAndroidBack: askToLeave };

    window.addEventListener("popstate", onPopState);
    return () => {
      setNativeSessionLock(false);
      window.CommitXSession = previousSessionBridge;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Standard mode: the timer keeps running in real time (absolute timestamps),
  // so screen-off, app switching and app restarts never pause it. Returning to
  // the foreground re-reads the clock and persists state, so the display picks
  // up exactly where real time is — never a stale frame or a jump.
  useEffect(() => {
    // Verified sessions handle their own lifecycle listeners (breaks included).
    if (isVerified) return;


    const resync = () => {
      if (doneRef.current) return;
      setNow(Date.now());
      persist();
      evaluateRef.current();

    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") resync();
      else persist();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", resync);
      window.removeEventListener("pageshow", resync);
      window.removeEventListener("pagehide", persist);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, phase, persist]);




  // Verified mode: foreground-only, with a 60s emergency grace window.
  useEffect(() => {
    if (!isVerified || dndBlocked) return;
    log("Verified Mode Armed", { startedAt, totalMs });
    setNativeVerifiedModeActive(phaseRef.current === "focus");

    const clearGrace = () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    };

    const failNow = (reason: VerifiedFailureReason) => {
      if (doneRef.current || phaseRef.current !== "focus") return;
      clearGrace();
      log("Verified Failure", { reason });
      markActiveVerifiedSessionPendingFailure(reason);
      complete("failed", reason);
    };

    const startGrace = (reason: VerifiedFailureReason) => {
      if (doneRef.current || graceTimerRef.current || phaseRef.current !== "focus") return;
      hiddenAtRef.current = Date.now();
      log("Verified Grace Started", { reason, ms: VERIFIED_GRACE_MS });
      graceTimerRef.current = setTimeout(() => {
        graceTimerRef.current = null;
        failNow("grace_expired");
      }, VERIFIED_GRACE_MS);
    };

    const onVisibility = () => {
      if (doneRef.current) return;
      if (document.visibilityState === "hidden") {
        // On the web, leaving the page fails immediately (handled by the
        // web-only effect below) — no grace window there.
        if (isWebRuntime()) return;
        startGrace("hidden");
      } else {
        const away = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        clearGrace();
        setNow(Date.now());
        log("Verified Returned", { away });
        evaluateRef.current();
      }
    };

    const onPageHide = (event: PageTransitionEvent) => {
      if (doneRef.current || phaseRef.current !== "focus") return;
      // Mobile browsers can emit pagehide when the power button turns the
      // screen off. Web lifecycle enforcement below handles true unloads via
      // beforeunload/reload markers without misclassifying a device lock.
      if (isWebRuntime()) return;
      if (event.persisted) return;
      markActiveVerifiedSessionPendingFailure("browser_unload");
    };
    const onBeforeUnload = () => {
      if (isWebRuntime()) return;
      if (phaseRef.current === "focus") markActiveVerifiedSessionPendingFailure("browser_unload");
    };
    const onNativeUserLeaveHint = (event: Event) =>
      failNow(eventReason(event, "android_user_leave"));
    const onNativeMultiWindow = () => failNow("multi_window");

    const previousBridge = window.CommitXVerifiedMode;
    window.CommitXVerifiedMode = {
      ...previousBridge,
      onAndroidUserLeaveHint: (reason) => failNow(reason || "android_user_leave"),
      onAndroidMultiWindow: () => failNow("multi_window"),
      fail: (reason) => failNow(reason || "android_user_leave"),
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("commitx:android-user-leave-hint", onNativeUserLeaveHint);
    window.addEventListener("commitx:native-user-leave-hint", onNativeUserLeaveHint);
    window.addEventListener("commitx:android-multi-window", onNativeMultiWindow);

    return () => {
      clearGrace();
      setNativeVerifiedModeActive(false);
      window.CommitXVerifiedMode = previousBridge;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("commitx:android-user-leave-hint", onNativeUserLeaveHint);
      window.removeEventListener("commitx:native-user-leave-hint", onNativeUserLeaveHint);
      window.removeEventListener("commitx:android-multi-window", onNativeMultiWindow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, dndBlocked]);

  /* ------------------------------------------------------------------ *
   * WEB ONLY — strict Verified Session enforcement.
   * The Android APK keeps its existing native behaviour: every listener
   * here is skipped whenever the native bridge is present.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isVerified || dndBlocked || !isWebRuntime()) return;

    let stopped = false;

    /** Single idempotent failure handler for web verified sessions. */
    const failWeb = (reason: VerifiedFailureReason) => {
      if (doneRef.current || stopped || phaseRef.current !== "focus") return;
      stopped = true;
      log("Web Verified Failure", { reason });
      markActiveVerifiedSessionPendingFailure(reason);
      void failWebSession(reason);
      clearWebSessionTab();
      // Stops the timer, records the failure locally, blocks any resume and
      // shows the existing Verified Session Failed screen.
      complete("failed", reason);
    };

    // Reload / reopen protection: a live verified session may never resume.
    // Claimed only once per mount, so an effect re-run is not a reload.
    if (webClaimedRef.current !== startedAt) {
      webClaimedRef.current = startedAt;
      if (claimWebSessionTab(startedAt).reloaded && phaseRef.current === "focus") {
        failWeb("web_reload");
        return;
      }
    }

    /**
     * A locked / auto-off screen is NOT a failure and the timer does NOT
     * pause: the countdown runs on wall-clock timestamps, so it keeps ticking
     * while the screen is dark and shows the correct remaining time the
     * moment the screen wakes. We only mark the session "away" so the
     * heartbeat stays in gentle keepalive mode. Tab switching, minimising
     * and app switching move focus elsewhere and still fail the session.
     */
    const beginAway = (_reason: string) => {
      if (doneRef.current || stopped) return;
      if (awayAtRef.current !== null) return;
      awayAtRef.current = Date.now();
      // Timer intentionally left running — screen-off must not pause it.
      void touchPausedWebSession();
    };

    const endAway = async () => {
      if (doneRef.current || stopped) return;
      // A sleeping browser suspends JavaScript and therefore misses heartbeat
      // intervals. Refresh liveness with the server clock before allowing the
      // strict heartbeat to run again; otherwise a long lock can be mistaken
      // for abandonment as soon as the screen wakes.
      if (awayAtRef.current !== null) await touchPausedWebSession();
      if (doneRef.current || stopped) return;
      awayAtRef.current = null;
      webBlurAtRef.current = null;
      setNow(Date.now());
      persist();
      evaluateRef.current();
    };

    /**
     * Samsung Chrome reports a power-button lock as hidden + unfocused, which
     * is indistinguishable from a tab switch through the Page Visibility API.
     * Therefore hidden alone is always treated as an allowed screen-off state.
     * Explicit unload/reload and visible-window blur remain failure paths.
     */
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") {
        void endAway();
        return;
      }
      webBlurAtRef.current = null;
      beginAway("screen_off");
    };

    // Focus moved to another window while this page is still visible
    // (split screen, second window). Confirmed after a short delay so
    // re-renders, scrolling and rotation never trigger it.
    const onBlur = () => {
      if (doneRef.current || stopped) return;
      if (document.visibilityState === "hidden") return;
      webBlurAtRef.current = Date.now();
      window.setTimeout(() => {
        if (doneRef.current || stopped) return;
        if (document.visibilityState === "hidden") return; // handled by onVisibility
        if (!document.hasFocus() && webBlurAtRef.current !== null) {
          failWeb("web_window_blur");
        }
      }, 1200);
    };


    const onFocus = () => {
      webBlurAtRef.current = null;
      if (document.visibilityState !== "hidden") void endAway();
    };

    const markUnload = () => {
      if (doneRef.current || stopped || phaseRef.current !== "focus") return;
      markActiveVerifiedSessionPendingFailure("web_unload");
      failWebSessionBeacon("web_unload");
    };

    // pagehide is intentionally not a failure signal: Samsung Chrome emits it
    // for a power-button lock. beforeunload plus the reload marker still catch
    // refreshes and navigations, while backend timeout covers abandoned tabs.
    const onBeforeUnload = () => markUnload();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    window.addEventListener("beforeunload", onBeforeUnload);

    // Heartbeat: the backend tracks liveness, but a paused/away session is kept
    // alive with the gentle touch so it can never be failed for being away.
    // A dropped connection must never end a session: while the device is
    // offline no check-in can reach the server, so the stored liveness stamp
    // goes stale on its own. When the connection returns we refresh liveness
    // first and only then allow the strict check to run again.
    let connectionGap = typeof navigator !== "undefined" && !isOnline();

    const markConnectionGap = () => {
      connectionGap = true;
    };

    const beat = async () => {
      if (doneRef.current || stopped) return;
      if (!isOnline()) {
        connectionGap = true;
        return;
      }
      if (phaseRef.current !== "focus" || awayAtRef.current !== null) {
        await touchPausedWebSession();
        connectionGap = false;
        return;
      }
      if (connectionGap) {
        // Reconnected (or just woke up) after a gap: restore liveness with the
        // server clock instead of judging the session on a stale stamp.
        await touchPausedWebSession();
        connectionGap = false;
        return;
      }
      const status = await heartbeatWebSession();
      if (status !== "failed") return;
      // Double-check: refresh liveness and ask once more, so a stale stamp
      // caused by sleep or a connection drop can never forfeit the session.
      await touchPausedWebSession();
      if (doneRef.current || stopped) return;
      const confirmed = await heartbeatWebSession();
      if (confirmed === "failed") failWeb("web_heartbeat_timeout");
    };
    void beat();
    const heartbeatId = setInterval(() => void beat(), WEB_HEARTBEAT_MS);
    window.addEventListener("offline", markConnectionGap);
    window.addEventListener("online", markConnectionGap);

    return () => {
      clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("offline", markConnectionGap);
      window.removeEventListener("online", markConnectionGap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, dndBlocked, startedAt]);



  const elapsedMs = Math.min(totalMs, accumulatedRef.current + (runningSinceRef.current ? now - runningSinceRef.current : 0));
  const progress = totalMs > 0 ? elapsedMs / totalMs : 0;
  const remaining = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));

  const onBreak = phase !== "focus";
  const breakRemaining = Math.max(
    0,
    Math.ceil(
      (RECOVERY_BREAK_MS - (breakStartedAtRef.current ? now - breakStartedAtRef.current : 0)) / 1000,
    ),
  );
  // Live study-progress notification (Android): timer + progress bar.
  useEffect(() => {
    if (doneRef.current) return;
    const label = mode === "verified" ? "Verified session" : "Standard session";
    if (phase === "recovery_break") {
      showSessionProgress(
        "Break time — take 5 minutes 🌿",
        `${fmt(breakRemaining)} left · your focus timer is paused.`,
        progress * 100,
      );
      return;
    }
    if (phase === "awaiting_confirmation") {
      showSessionProgress(
        "Your break is over. Ready to focus back?",
        "Return to CommitX and tap YES when you're ready.",
        progress * 100,
      );
      return;
    }
    showSessionProgress(
      `${label} \u00B7 ${fmt(remaining)} left`,
      `${goal} \u00B7 ${Math.round(progress * 100)}% of ${duration} min complete`,
      progress * 100,
    );
  }, [remaining, progress, goal, duration, mode, phase, breakRemaining]);

  useEffect(() => () => hideSessionProgress(), []);

  // Native one-shot alarms keep both sound cues reliable while the WebView is
  // minimized or suspended. Event keys make native alarms and foreground
  // transitions converge on one playback rather than duplicating it.
  useEffect(() => {
    if (!breaksApply || doneRef.current) return;
    const index = breaksTakenRef.current;
    if (phase === "focus" && index === 0) {
      const fireAt = Date.now() + Math.max(0, halfwayMs - elapsedNow());
      scheduleWellnessSound(`${wellnessSessionKey}_break_${index}_start`, "start", fireAt);
      scheduleWellnessSound(
        `${wellnessSessionKey}_break_${index}_end`,
        "end",
        fireAt + RECOVERY_BREAK_MS,
      );
    } else {
      const anchor = breakStartedAtRef.current;
      if (anchor) {
        scheduleWellnessSound(
          `${wellnessSessionKey}_break_${index}_end`,
          "end",
          anchor + RECOVERY_BREAK_MS,
        );
      }
    }
  }, [breaksApply, elapsedNow, halfwayMs, phase, wellnessSessionKey]);

  useEffect(
    () => () => cancelWellnessSounds(wellnessSessionKey),
    [wellnessSessionKey],
  );

  async function complete(status: "completed" | "failed", reason?: string) {
    // Idempotent: prevents duplicate deductions and duplicate session rows.
    if (doneRef.current) return;
    doneRef.current = true;
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    graceTimerRef.current = null;
    runningSinceRef.current = null;
    setNativeSessionLock(false);
    setNativeVerifiedModeActive(false);
    clearActiveVerifiedSession();
    hideSessionProgress();
    // Focus Shield always releases the moment a session ends, however it ended.
    stopShield();
    setShieldOn(false);

    cancelWellnessSounds(wellnessSessionKey);
    // Permanent end marker + server slot release: the timer can never be
    // restarted or resurrected by back navigation, refresh or app restart.
    markSessionEnded({
      goal,
      duration,
      value,
      mode: mode as Mode,
      status,
      ...(reason ? { reason } : {}),
    });
    // Web-only tab state is local. The authoritative active row is settled by
    // recordSessions below, in the same transaction that records coins.
    if (isVerified && isWebRuntime()) {
      clearWebSessionTab();
    }

    if (guestRef.current) {
      // No account: no coin movement and no saved history.
      if (status === "completed") {
        log("Session Completed");
      } else {
        log("Session Failed", { reason: reason ?? "unknown" });
      }
      navigate({
        to: status === "completed" ? "/success" : "/failed",
        search: {
          goal,
          duration: String(duration),
          value: "0",
          ...(reason ? { reason } : {}),
        } as Record<string, string>,
      });
      return;
    }

    const current = getState();
    const coinsSpent = status === "failed" ? Math.min(value, current.coins) : 0;
    const coinsEarned = status === "completed" ? coinsForMinutes(duration) : 0;
    const session = {
      id: createLocalSessionId(),
      goal,
      durationMinutes: duration,
      value,
      mode: mode as Mode,
      status,
      date: Date.now(),
      coinsSpent,
      coinsEarned,
    };
    let authoritativeCoins: number | null = null;
    let refused = false;
    if (isOnline()) {
      const payload = {
        sessions: [{
          id: session.id,
          goal: session.goal,
          durationMinutes: session.durationMinutes,
          value: session.value,
          mode: session.mode,
          status: session.status,
          endedAt: session.date,
        }],
      };
      try {
        let result = await recordSessions({ data: payload });
        if (result.rejected.includes(session.id)) {
          // One short retry absorbs a few seconds of device/server clock drift.
          await new Promise((r) => setTimeout(r, 1500));
          result = await recordSessions({ data: payload });
        }
        if (result.ids.includes(session.id)) {
          authoritativeCoins = result.coins;
          markSessionSynced(session.id);
        } else if (result.rejected.includes(session.id)) {
          // The server has no genuine claim for this outcome: nothing to count.
          authoritativeCoins = result.coins;
          refused = true;
        }
      } catch {
        // Keep the active server record intact so cloud sync can retry safely.
      }
    }
    // Completing returns the committed coins untouched and adds the hourly
    // reward; failing forfeits the committed coins. The server's numbers win.
    setState((s) => ({
      ...s,
      sessions: refused ? s.sessions : [session, ...s.sessions],
      coins: authoritativeCoins ?? Math.max(0, s.coins - coinsSpent + coinsEarned),
    }));
    if (refused) markSessionSynced(session.id);
    if (status === "completed") {
      log("Session Completed");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(80);
        } catch {}
      }
    } else {
      log("Session Failed", { reason: reason ?? "unknown" });
    }
    navigate({
      to: status === "completed" ? "/success" : "/failed",
      search: {
        goal,
        duration: String(duration),
        value: String(value),
        ...(reason ? { reason } : {}),
      } as Record<string, string>,
    });
  }

  function quit() {
    complete("failed", "quit");
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-background px-6 pb-10 pt-14">
      <SessionScene
        theme={sessionTheme}
        progress={progress}
        paused={onBreak}
        className="z-0"
      />
      <div className="relative z-10 flex items-center justify-center">

        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {isVerified ? "Verified session" : "Standard session"}
        </p>
        <button
          onClick={() => setConfirmQuit(true)}
          className="absolute right-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
          aria-label="End session"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Everything stays on one centred axis; the countdown reserves fixed
          space so changing digits never shift the hourglass sideways. */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 md:justify-start md:gap-8 md:pt-16 lg:pt-20">
        <div className="mx-auto grid h-[226px] w-[226px] shrink-0 place-items-center overflow-visible">
          <Hourglass
            size={226}
            state={onBreak ? "idle" : "running"}
            progress={progress}
          />
        </div>
        <div className="mx-auto grid w-[18rem] shrink-0 place-items-center text-center">
          <p className="h-[4.5rem] w-full text-center font-display text-6xl font-semibold tabular-nums tracking-tight">
            {fmt(remaining)}
          </p>
          <p className="mt-3 block w-full text-center text-sm text-muted-foreground">{goal}</p>
          {value > 0 && (
            <p className="mt-1 block w-full text-center text-xs text-muted-foreground">
              {coinLabel(value)} committed
            </p>
          )}
          {isVerified && !onBreak && (
            <p className="mt-6 rounded-full bg-foreground/5 px-4 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              Leaving CommitX fails this session
            </p>
          )}
          {!isVerified && shieldOn && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-[11px] font-medium uppercase tracking-widest text-primary">
              <Shield className="h-3.5 w-3.5" />
              Focus Shield ON
            </p>
          )}

          {onBreak && (
            <p className="mt-6 rounded-full bg-primary/10 px-4 py-1.5 text-[11px] uppercase tracking-widest text-primary">
              Wellness break · timer paused
            </p>
          )}
        </div>
      </div>


      <div className="relative z-10 mx-auto w-full max-w-md pb-2 text-center">
        <span className="mx-auto block h-px w-16 bg-hairline" />
        <p className="mt-5 px-2 font-display text-base leading-relaxed text-foreground/80">
          “{quote}”
        </p>
        <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
          Stay with it · turning discipline into impact
        </p>
      </div>




      {onBreak && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/90 px-4 pb-5 backdrop-blur-md sm:items-center sm:pb-0">
          <div className="w-full max-w-sm animate-scale-in rounded-3xl border border-hairline bg-card px-6 py-5 text-center shadow-lift">
            {phase === "recovery_break" ? (
              <>
                <BreakIllustration />
                <p className="mt-1 font-display text-xl font-semibold">Break time 🌿</p>
                <p className="mt-1 text-sm text-muted-foreground">Breathe, stretch, or sip something.</p>
                <p className="mt-4 font-display text-4xl font-semibold tabular-nums text-primary">
                  {fmt(breakRemaining)}
                </p>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear"
                    style={{
                      width: `${Math.min(100, Math.max(0, 100 - (breakRemaining / (RECOVERY_BREAK_MS / 1000)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Your focus timer is frozen exactly where it stopped.
                </p>
                <p className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  You may step away · your session stays safe
                </p>
              </>
            ) : (
              <>
                <BreakIllustration />
                <p className="mt-2 font-display text-2xl font-semibold">Ready to focus back?</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your timer remains paused until you’re ready.
                </p>
                <Button
                  onClick={confirmRefreshed}
                  size="lg"
                  className="mt-5 h-12 w-full rounded-full"
                >
                  YES
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {dndBlocked && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-card p-6 text-center shadow-lift">
            <BellOff className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-xl font-semibold">Do Not Disturb required</p>
            <p className="mt-2 text-sm text-muted-foreground">
              DND is required for Verified Mode. Please enable it in Settings.
            </p>
            <button
              onClick={openDndSettings}
              className="mt-6 w-full rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground"
            >
              Open Settings
            </button>
            <button
              onClick={() => navigate({ to: "/commit" })}
              className="mt-3 w-full rounded-full border border-hairline bg-background px-6 py-3 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmQuit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
            <p className="font-display text-xl font-semibold">
              {isVerified ? "Warning" : "Leave Session?"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isVerified
                ? "Ending this session will immediately forfeit your committed amount."
                : "Ending this session will forfeit your committed amount."}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => setConfirmQuit(false)}
                className="w-full rounded-full border border-hairline bg-background px-5 py-3.5 text-sm font-medium"
              >
                {isVerified ? "Stay Focused" : "Stay & Continue"}
              </button>
              <button
                onClick={quit}
                className="w-full rounded-full bg-destructive px-5 py-3.5 text-sm font-medium text-destructive-foreground"
              >
                End Session &amp; Lose Commitment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
