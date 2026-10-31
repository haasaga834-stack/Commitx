import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { releaseSessionDnd, setNativeSessionLock, setNativeVerifiedModeActive } from "@/lib/native-session";
import { Hourglass } from "@/components/Hourglass";
import { z } from "zod";
import { coinLabel } from "@/lib/commitx-store";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const search = z.object({
  goal: z.string().default("Focus"),
  duration: z.coerce.number().default(0),
  value: z.coerce.number().default(0),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/failed")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "CommitX — Commitment failed" },
      { name: "description", content: "The promise wasn't kept this time." },
      { property: "og:title", content: "CommitX — Commitment failed" },
      { property: "og:description", content: "The promise wasn't kept this time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Failed,
});

function reasonCopy(reason?: string) {
  switch (reason) {
    case "app_switch":
      return "You left CommitX while using Verified Mode.";
    case "android_user_leave":
      return "CommitX was sent to the background during Verified Mode.";
    case "home":
      return "The Home button was used during Verified Mode.";
    case "recents":
      return "Recent Apps was opened during Verified Mode.";
    case "multi_window":
    case "split_screen":
      return "Split-screen or multi-window was opened during Verified Mode.";
    case "browser_unload":
      return "CommitX was closed during Verified Mode.";
    case "background":
      return "You left CommitX while using Verified Mode.";
    case "killed":
      return "The app was closed during a Verified session.";
    case "recovery_timeout":
      return "You didn’t confirm you were refreshed within 30 seconds after the recovery break.";
    case "quit":
      return "You ended the session before it completed.";

    default:
      return "The session was not completed.";
  }
}

function Failed() {
  const { goal, value, reason } = Route.useSearch();
  const navigate = useNavigate();
  const isVerifiedBreak = Boolean(reason && reason !== "quit");

  // The session is over: back navigation is neutralised here so nothing can
  // walk back into the timer. "Return Home" is the only way out.
  useEffect(() => {
    setNativeSessionLock(false);
    setNativeVerifiedModeActive(false);
    releaseSessionDnd();

    const pushGuard = () => {
      try {
        window.history.pushState({ commitxResult: Date.now() }, "");
      } catch {}
    };
    pushGuard();

    const onPopState = () => {
      pushGuard();
      navigate({ to: "/", replace: true });
    };

    const previousBridge = window.CommitXSession;
    window.CommitXSession = {
      ...previousBridge,
      onAndroidBack: () => navigate({ to: "/", replace: true }),
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.CommitXSession = previousBridge;
      window.removeEventListener("popstate", onPopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Hourglass size={200} state="failed" />
      <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3 text-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
          <X className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <h1 className="w-full min-w-0 text-center font-display text-3xl font-semibold leading-tight animate-fade-up">
          Commitment Failed
        </h1>
      </div>
      <p
        className="mt-2 w-full max-w-xs break-words text-center text-sm text-muted-foreground animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        {goal}
      </p>

      {isVerifiedBreak && (
        <div
          className="mt-6 max-w-xs rounded-3xl bg-card px-5 py-4 text-center shadow-soft animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Reason
          </p>
          <p className="mt-2 text-sm text-foreground">{reasonCopy(reason)}</p>
        </div>
      )}

      <p
        className="mt-5 w-full max-w-xs rounded-2xl bg-foreground/5 px-5 py-3 text-center text-sm text-foreground animate-fade-up"
        style={{ animationDelay: "180ms" }}
      >
        {coinLabel(value)} forfeited from your Cx Coin balance
      </p>

      <Button asChild className="mt-8 h-14 w-full max-w-xs rounded-full bg-foreground px-8 text-center text-base font-medium text-background shadow-soft hover:bg-foreground/90">
        <Link to="/" replace>Return Home</Link>
      </Button>
    </div>
  );
}
