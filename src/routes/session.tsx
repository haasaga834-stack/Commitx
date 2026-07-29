import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Hourglass } from "@/components/Hourglass";
import { setState, formatINR, planDeduction, getState, type Mode } from "@/lib/commitx-store";
import {
  clearActiveVerifiedSession,
  markActiveVerifiedSessionPendingFailure,
  readActiveVerifiedSession,
  writeActiveVerifiedSession,
  type VerifiedFailureReason,
} from "@/lib/verified-mode";
import { X } from "lucide-react";
import { z } from "zod";

declare global {
  interface Window {
    CommitXVerifiedMode?: {
      onAndroidUserLeaveHint?: (reason?: VerifiedFailureReason) => void;
      onAndroidMultiWindow?: () => void;
      fail?: (reason?: VerifiedFailureReason) => void;
    };
    CommitXAndroid?: {
      setVerifiedModeActive?: (active: boolean) => void;
      clearPendingFailure?: () => void;
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

function setNativeVerifiedModeActive(active: boolean) {
  try {
    window.CommitXAndroid?.setVerifiedModeActive?.(active);
    if (!active) window.CommitXAndroid?.clearPendingFailure?.();
  } catch {}
}

function Session() {
  const { goal, duration, value, mode, preferReal } = Route.useSearch();
  const navigate = useNavigate();
  const totalMs = duration * 60 * 1000;
  const preferRealBool = preferReal === "1";

  const startedAt = useRef<number>(
    (() => {
      if (typeof window === "undefined") return Date.now();
      try {
        const prev = readActiveVerifiedSession();
        if (
          prev &&
          prev.goal === goal &&
          prev.duration === duration &&
          prev.value === value &&
          prev.mode === mode &&
          typeof prev.startedAt === "number"
        ) {
          return prev.startedAt;
        }
      } catch {}
      const now = Date.now();
      writeActiveVerifiedSession({ goal, duration, value, mode, preferReal: preferRealBool, startedAt: now });
      return now;
    })(),
  ).current;

  const [now, setNow] = useState<number>(() => Date.now());
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const doneRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);
  const blurAtRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (!doneRef.current && t - startedAt >= totalMs) {
        complete("completed");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "verified") return;
    log("Verified Mode Armed", { startedAt, totalMs });
    setNativeVerifiedModeActive(true);

    const failForVerifiedExit = (reason: VerifiedFailureReason) => {
      if (doneRef.current) return;
      log("Android Foreground Exit", { reason });
      markActiveVerifiedSessionPendingFailure(reason);
      setNow(Date.now());
      complete("failed", reason);
    };

    const markPendingExit = (reason: VerifiedFailureReason) => {
      if (doneRef.current) return;
      log("Verified Exit Pending", { reason });
      markActiveVerifiedSessionPendingFailure(reason);
    };

    const onVisibility = () => {
      if (doneRef.current) return;
      if (document.visibilityState === "hidden") {
        log("Visibility Hidden", { treatedAs: "allowed_lock_call_or_system_shade" });
        hiddenAtRef.current = Date.now();
      } else {
        const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        setNow(Date.now());
        log("Visibility Visible", { hiddenFor });
      }
    };

    const onBlur = () => {
      blurAtRef.current = Date.now();
      log("Window Blur", { treatedAs: "allowed_overlay_keyboard_call_or_notification_shade" });
    };
    const onFocus = () => {
      const blurredFor = blurAtRef.current ? Date.now() - blurAtRef.current : 0;
      blurAtRef.current = null;
      setNow(Date.now());
      log("Window Focus", { blurredFor });
    };
    const onPageHide = (event: PageTransitionEvent) => {
      if (doneRef.current) return;
      if (event.persisted) {
        log("Page Hidden", { pagehide: "persisted" });
        return;
      }
      markPendingExit("browser_unload");
      failForVerifiedExit("app_switch");
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (doneRef.current) return;
      setNow(Date.now());
      log("Page Visible", { pageshow: true, restored: event.persisted });
    };
    const onBeforeUnload = () => {
      markPendingExit("browser_unload");
    };
    const onFreeze = () => {
      log("Page Frozen", { treatedAs: "allowed_until_native_user_leave_hint" });
    };
    const onResume = () => {
      setNow(Date.now());
      log("Page Resumed");
    };
    const onNativeUserLeaveHint = (event: Event) => {
      failForVerifiedExit(eventReason(event, "android_user_leave"));
    };
    const onNativeMultiWindow = () => {
      failForVerifiedExit("multi_window");
    };

    const previousBridge = window.CommitXVerifiedMode;
    window.CommitXVerifiedMode = {
      ...previousBridge,
      onAndroidUserLeaveHint: (reason) => failForVerifiedExit(reason || "android_user_leave"),
      onAndroidMultiWindow: () => failForVerifiedExit("multi_window"),
      fail: (reason) => failForVerifiedExit(reason || "android_user_leave"),
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("freeze", onFreeze);
    document.addEventListener("resume", onResume);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("commitx:android-user-leave-hint", onNativeUserLeaveHint);
    window.addEventListener("commitx:native-user-leave-hint", onNativeUserLeaveHint);
    window.addEventListener("commitx:android-multi-window", onNativeMultiWindow);

    return () => {
      setNativeVerifiedModeActive(false);
      window.CommitXVerifiedMode = previousBridge;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("freeze", onFreeze);
      document.removeEventListener("resume", onResume);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("commitx:android-user-leave-hint", onNativeUserLeaveHint);
      window.removeEventListener("commitx:native-user-leave-hint", onNativeUserLeaveHint);
      window.removeEventListener("commitx:android-multi-window", onNativeMultiWindow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const elapsedMs = Math.min(totalMs, now - startedAt);
  const progress = totalMs > 0 ? elapsedMs / totalMs : 0;
  const remaining = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));

  function complete(status: "completed" | "failed", reason?: string) {
    if (doneRef.current) return;
    doneRef.current = true;
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
    <div className="flex min-h-screen flex-col bg-background px-6 pb-10 pt-14">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {mode === "verified" ? "Verified session" : "Standard session"}
        </p>
        <button
          onClick={() => setConfirmQuit(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
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
        <p className="mt-1 text-xs text-muted-foreground">
          {formatINR(value)} committed
        </p>
        {mode === "verified" && (
          <p className="mt-6 rounded-full bg-foreground/5 px-4 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            Leaving CommitX fails this session
          </p>
        )}
        <p className="mt-10 text-xs italic text-muted-foreground">"{quote}"</p>
      </div>

      {confirmQuit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
            <p className="font-display text-xl font-semibold">End this session?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "verified"
                ? "This will fail your commitment and deduct your committed value."
                : "You can restart anytime. Ending now marks this commitment as failed."}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmQuit(false)}
                className="flex-1 rounded-full border border-hairline bg-background px-5 py-3 text-sm font-medium"
              >
                Stay
              </button>
              <button
                onClick={quit}
                className="flex-1 rounded-full bg-destructive px-5 py-3 text-sm font-medium text-destructive-foreground"
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
