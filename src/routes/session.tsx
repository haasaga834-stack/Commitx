import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hourglass } from "@/components/Hourglass";
import { setState, formatINR, planDeduction, getState, type Mode } from "@/lib/commitx-store";
import {
  clearActiveVerifiedSession,
  markActiveVerifiedSessionPendingFailure,
  readActiveVerifiedSession,
  writeActiveVerifiedSession,
  type VerifiedFailureReason,
} from "@/lib/verified-mode";
import {
  canCheckDnd,
  isDndEnabled,
  openDndSettings,
  setNativeSessionLock,
  setNativeVerifiedModeActive,
} from "@/lib/native-session";
import { BellOff, X } from "lucide-react";

import { showSessionProgress, hideSessionProgress } from "@/lib/native-notifications";
import { z } from "zod";

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
  preferReal: z.string().optional(),
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
  // eslint-disable-next-line no-console
  console.log(`[CommitX lifecycle] ${evt}`, extra ?? "");
}

function eventReason(event: Event, fallback: VerifiedFailureReason) {
  if (event instanceof CustomEvent && event.detail && typeof event.detail.reason === "string") {
    return event.detail.reason;
  }
  return fallback;
}

function Session() {
  const { goal, duration, value, mode, preferReal } = Route.useSearch();
  const navigate = useNavigate();
  const totalMs = duration * 60 * 1000;
  const preferRealBool = preferReal === "1";
  const isVerified = mode === "verified";

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
          if (!started || sinceStart < 0 || sinceStart > 6 * 60 * 60 * 1000) return null;
          const banked =
            (prev.accumulatedMs ?? 0) +
            (prev.runningSince ? Math.max(0, Date.now() - prev.runningSince) : 0);
          // Never restore something that would instantly finish.
          if (banked >= duration * 60 * 1000) return null;
          return prev;
        })(),
  ).current;

  const startedAt = useRef<number>(restored?.startedAt ?? Date.now()).current;
  const accumulatedRef = useRef<number>(restored?.accumulatedMs ?? 0);
  const runningSinceRef = useRef<number | null>(
    restored ? (restored.runningSince ?? null) : Date.now(),
  );


  const [now, setNow] = useState<number>(() => Date.now());
  const [, setPaused] = useState<boolean>(() => runningSinceRef.current === null);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const doneRef = useRef(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  const persist = useCallback(() => {
    writeActiveVerifiedSession({
      goal,
      duration,
      value,
      mode,
      preferReal: preferRealBool,
      startedAt,
      accumulatedMs: accumulatedRef.current,
      runningSince: runningSinceRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, duration, value, mode, preferRealBool, startedAt]);

  const elapsedNow = useCallback(() => {
    const running = runningSinceRef.current;
    const banked = accumulatedRef.current + (running ? Date.now() - running : 0);
    // Verified sessions are anchored to the wall clock: banked time can never
    // exceed the real time passed since the session started, so re-renders,
    // backgrounding or restored state can't shorten the commitment.
    if (isVerified) return Math.max(0, Math.min(banked, Date.now() - startedAt));
    return Math.max(0, banked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, startedAt]);

  /**
   * Authoritative completion gate. A session may only finish once the full
   * committed duration has genuinely elapsed; Verified sessions additionally
   * require the wall clock since start to have passed, which makes early or
   * duplicate completion impossible.
   */
  const canCompleteNow = useCallback(() => {
    if (elapsedNow() < totalMs) return false;
    if (isVerified && Date.now() - startedAt < totalMs) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedNow, totalMs, isVerified, startedAt]);


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

  // Keep the stored session in sync from the very first render.
  useEffect(() => {
    if (dndBlocked) {
      pauseTimer("dnd_required");
      return;
    }
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll DND while blocked so returning from settings unblocks automatically.
  useEffect(() => {
    if (!dndBlocked) return;
    const id = setInterval(() => {
      if (isDndEnabled() !== false) {
        setDndBlocked(false);
        resumeTimer("dnd_enabled");
      }
    }, 1200);
    return () => clearInterval(id);
  }, [dndBlocked, resumeTimer]);

  // Single animation loop — guards against duplicate timers via doneRef.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      if (!doneRef.current && !dndBlocked && canCompleteNow()) {
        complete("completed");
        return;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dndBlocked]);

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
    if (isVerified) return;

    const resync = () => {
      if (doneRef.current) return;
      setNow(Date.now());
      persist();
      if (canCompleteNow()) complete("completed");
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
  }, [isVerified, persist, elapsedNow, totalMs]);




  // Verified mode: foreground-only, with a 60s emergency grace window.
  useEffect(() => {
    if (!isVerified || dndBlocked) return;
    log("Verified Mode Armed", { startedAt, totalMs });
    setNativeVerifiedModeActive(true);

    const clearGrace = () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    };

    const failNow = (reason: VerifiedFailureReason) => {
      if (doneRef.current) return;
      clearGrace();
      log("Verified Failure", { reason });
      markActiveVerifiedSessionPendingFailure(reason);
      complete("failed", reason);
    };

    const startGrace = (reason: VerifiedFailureReason) => {
      if (doneRef.current || graceTimerRef.current) return;
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
        startGrace("hidden");
      } else {
        const away = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        clearGrace();
        setNow(Date.now());
        log("Verified Returned", { away });
      }
    };
    const onPageHide = (event: PageTransitionEvent) => {
      if (doneRef.current) return;
      if (event.persisted) return;
      markActiveVerifiedSessionPendingFailure("browser_unload");
    };
    const onBeforeUnload = () => markActiveVerifiedSessionPendingFailure("browser_unload");
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

  const elapsedMs = Math.min(totalMs, accumulatedRef.current + (runningSinceRef.current ? now - runningSinceRef.current : 0));
  const progress = totalMs > 0 ? elapsedMs / totalMs : 0;
  const remaining = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));

  // Live study-progress notification (Android): timer + progress bar.
  useEffect(() => {
    if (doneRef.current) return;
    const label = mode === "verified" ? "Verified session" : "Standard session";
    showSessionProgress(
      `${label} \u00B7 ${fmt(remaining)} left`,
      `${goal} \u00B7 ${Math.round(progress * 100)}% of ${duration} min complete`,
      progress * 100,
    );
  }, [remaining, progress, goal, duration, mode]);

  useEffect(() => () => hideSessionProgress(), []);

  function complete(status: "completed" | "failed", reason?: string) {
    // Idempotent: prevents duplicate deductions and duplicate session rows.
    if (doneRef.current) return;
    doneRef.current = true;
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    graceTimerRef.current = null;
    runningSinceRef.current = null;
    setNativeSessionLock(false);
    setNativeVerifiedModeActive(false);
    clearActiveVerifiedSession();
    const current = getState();
    const plan = planDeduction(value, current.balances, preferRealBool);
    const demoUsed = plan.ok ? plan.demoUsed : 0;
    const realUsed = plan.ok ? plan.realUsed : 0;
    const session = {
      id: `${Date.now()}`,
      goal,
      durationMinutes: duration,
      value,
      mode: mode as Mode,
      status,
      date: Date.now(),
      demoUsed,
      realUsed,
    };
    setState((s) => {
      if (status === "completed") {
        // No net change: value was earmarked and now returned.
        return { ...s, sessions: [session, ...s.sessions] };
      }
      return {
        ...s,
        sessions: [session, ...s.sessions],
        balances: {
          demo: Math.max(0, s.balances.demo - demoUsed),
          real: Math.max(0, s.balances.real - realUsed),
        },
      };
    });
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
    <div className="flex min-h-screen flex-col px-6 pb-10 pt-14">
      <div className="relative flex items-center justify-center">
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

      <div className="flex flex-1 flex-col items-center justify-center">
        <Hourglass size={260} state="running" progress={progress} />
        <p className="mt-10 font-display text-6xl font-semibold tabular-nums tracking-tight">
          {fmt(remaining)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{goal}</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatINR(value)} committed</p>
        {isVerified && (
          <p className="mt-6 rounded-full bg-foreground/5 px-4 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            Leaving CommitX fails this session
          </p>
        )}
      </div>

      <div className="mx-auto w-full max-w-md pb-2 text-center">
        <span className="mx-auto block h-px w-16 bg-hairline" />
        <p className="mt-5 px-2 font-display text-base leading-relaxed text-foreground/80">
          “{quote}”
        </p>
        <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
          Stay with it · turning discipline into impact
        </p>
      </div>



      {dndBlocked && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-card p-6 text-center shadow-lift">
            <BellOff className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-xl font-semibold">Turn on Do Not Disturb</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Verified sessions can only start with Do Not Disturb enabled.
            </p>
            <button
              onClick={openDndSettings}
              className="mt-6 w-full rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground"
            >
              Open Do Not Disturb settings
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
