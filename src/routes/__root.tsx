import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { accountabilityAppOpened } from "@/lib/accountability";
import { usePresenceTracker } from "@/lib/presence";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import {
  finalizePendingVerifiedFailure,
  markSessionEnded,
  readActiveVerifiedSession,
  readRestorableActiveSession,
} from "../lib/verified-mode";
import { releaseActiveDbSession } from "../lib/active-session";
import { useAuth } from "../lib/use-auth";
import { identifyUser, initAnalytics } from "../lib/analytics";
import { useStudyReminders } from "../lib/planner";
import { reconcileMotivationNotifications } from "../lib/native-notifications";
import { hasNativeBridge } from "../lib/native-session";
import { registerAppServiceWorker } from "../lib/pwa";
import { AmbientNature } from "../components/AmbientNature";
import { OfflineNotice } from "../components/OfflineNotice";
import { Onboarding } from "../components/Onboarding";
import { useOnboarding } from "../lib/onboarding";
import { NativeWelcome } from "../components/NativeWelcome";
import { StudyWidgetCoordinator } from '../components/StudyWidgetCoordinator';
import { BuddyNotifier } from '../components/BuddyNotifier';
import { isNativeLaunchReady, shouldShowNativeWelcome } from "../lib/app-launch";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-6xl font-semibold text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went off track</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Take a breath and try again.
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F5F1E6" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "CommitX" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/icon-192x192.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Warms the backend connection so the session check starts immediately.
      { rel: "preconnect", href: "https://ldnjfjmwzqczjmewzdai.supabase.co", crossOrigin: "anonymous" },

      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600&family=Sora:wght@300;400;500;600&display=swap",
      },
    ],
    scripts: [
      {
        children:
          "try{var m=localStorage.getItem('commitx-theme-v1');if(m==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}",
      },
      {
        // Android app Google sign-in opens in a browser tab. If Google's
        // return lands on the website instead of the app, hand the session
        // straight back into the CommitX app so the user stays in the app.
        children:
          "try{var h=location.hash;if(h&&h.indexOf('access_token=')>-1&&h.indexOf('refresh_token=')>-1&&h.indexOf('provider_token=')>-1&&!window.CommitXAndroid&&/Android/i.test(navigator.userAgent)&&!/; wv\\)/.test(navigator.userAgent)){var q=h.replace(/^#/,'');var u='intent://login-callback/?'+q+'#Intent;scheme=commitx;package=app.commitx.mobile;end';history.replaceState(null,'',location.pathname);window.__cxHandoff=u;location.replace(u);document.addEventListener('DOMContentLoaded',function(){document.body.innerHTML='<div style=\"min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:sans-serif;background:#eef6f2;color:#123;text-align:center;padding:24px\"><div style=\"font-size:22px;font-weight:600\">Signed in</div><a href=\"'+u+'\" style=\"background:#0f5c4f;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600\">Return to CommitX</a></div>';});}}catch(e){}",
      },
    ],


  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function VerifiedRecovery() {
  const router = useRouter();
  useEffect(() => {
    const recover = () => {
      const active = readActiveVerifiedSession();
      if (!active || active.mode !== "verified" || !active.pendingFail) return;
      const failure = finalizePendingVerifiedFailure();
      if (!failure) return;
      // The session stays ended across app restarts and frees the server slot.
      markSessionEnded({
        goal: failure.goal,
        duration: failure.duration,
        value: failure.value,
        mode: "verified",
        status: "failed",
        reason: failure.reason,
      });
      void releaseActiveDbSession();
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[CommitX lifecycle] Session Failed", {
          reason: failure.reason,
          recovered: true,
        });
      }

      if (router.state.location.pathname !== "/failed") {
        router.navigate({
          to: "/failed",
          search: {
            goal: String(failure.goal),
            duration: String(failure.duration),
            value: String(failure.value),
            reason: failure.reason,
          } as Record<string, string>,
        });
      }
    };

    try {
      recover();
    } catch {}

    const onNativePendingFailure = () => {
      try {
        recover();
      } catch {}
    };

    // Coming back to the foreground — including a tap on the timer
    // notification — must settle an already-failed Verified session instead of
    // leaving it in limbo. The tap never changes the state; it only reveals it.
    const onForeground = () => {
      if (document.visibilityState !== "visible") return;
      try {
        recover();
      } catch {}
    };

    window.addEventListener("commitx:verified-pending-failure", onNativePendingFailure);
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      window.removeEventListener("commitx:verified-pending-failure", onNativePendingFailure);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, [router]);
  return null;
}

const PUBLIC_PATHS = [
  // Public front door + guest session flow (no account required to start).
  "/",
  "/commit",
  "/session",
  "/success",
  "/failed",
  "/focus-class",
  "/auth",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/about",
  "/contact",
  "/how-it-works",
  "/study-tracker",
  "/focus-timer",
  "/study-accountability",
  "/group-study",
  "/verified-focus",
  "/standard-focus",
  "/reset-password",
];

function isPublicPath(path: string) {
  const normalized =
    path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") : path;
  return PUBLIC_PATHS.includes(normalized.toLowerCase());
}

function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const pathname = router.state.location.pathname;
  const { needsOnboarding, complete } = useOnboarding(user?.id ?? null);
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    initAnalytics();
  }, []);
  useEffect(() => {
    if (!loading) identifyUser(user?.id ?? null);
  }, [user?.id, loading]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic && pathname !== "/auth") {
      const buddyMatch = /^\/buddy\/([A-Za-z0-9]{6})\/?$/.exec(pathname);
      if (buddyMatch) {
        try { localStorage.setItem("commitx-pending-buddy", buddyMatch[1].toUpperCase()); } catch {}
      }
      router.navigate({ to: "/auth" });
    }
    if (user && pathname === "/auth") {
      router.navigate({ to: "/" });
    }
  }, [user, loading, pathname, router, isPublic]);

  // Dismiss the native Android startup screen only once the first real screen
  // can be shown, so a cold start never flashes an empty page.
  useEffect(() => {
    if (!hasNativeBridge()) return;
    if (!isNativeLaunchReady(loading, Boolean(user), pathname)) return;
    if (loading && !isPublic) return;
    let paintFrame = 0;
    const frame = requestAnimationFrame(() => {
      paintFrame = requestAnimationFrame(() => {
        try {
          (window as unknown as { CommitXAndroid?: { appReady?: () => void } })
            .CommitXAndroid?.appReady?.();
        } catch {}
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(paintFrame);
    };
  }, [loading, isPublic, user, pathname]);


  if (loading && !isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
      </div>
    );
  }

  if (!user && !isPublic && pathname !== "/auth") return null;
  return (
    <>
      {children}
      <StudyWidgetCoordinator userId={user?.id ?? null} onboarding={needsOnboarding} />
      <BuddyNotifier userId={user?.id ?? null} hidden={needsOnboarding || pathname === "/session" || pathname.startsWith("/group/")} />
      {user && pathname !== "/auth" && needsOnboarding ? (
        hasNativeBridge() ? (
          shouldShowNativeWelcome(pathname, Boolean(readRestorableActiveSession())) ? (
            <NativeWelcome userId={user.id} onDone={() => void complete()} />
          ) : null
        ) : <Onboarding onDone={() => void complete()} />
      ) : null}
    </>
  );
}

/**
 * Opening the app from the live timer notification (or relaunching it after
 * Android killed it) may land on the last route instead of the timer. A running
 * session must be re-entered exactly where it is — same commitment, same
 * elapsed time — never restarted, cancelled or charged. Runs once per app load
 * only, so navigating away during a session stays the user's own choice.
 */
function ActiveSessionRestore() {
  const router = useRouter();
  useEffect(() => {
    try {
      const path = router.state.location.pathname.toLowerCase();
      // Result screens and the timer itself already handle their own state.
      if (path === "/session" || path === "/success" || path === "/failed") return;

      const active = readRestorableActiveSession();
      if (!active) return;

      router.navigate({
        to: "/session",
        search: {
          goal: active.goal,
          duration: active.duration,
          value: active.value,
          mode: active.mode,
          ...(active.theme ? { theme: active.theme } : {}),
        },
        replace: true,
      });
    } catch {}
    // Intentionally start-of-app only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function StudyReminders() {
  useStudyReminders();
  // Re-arms the native 8:00 AM / 7:00 PM motivation alarms; idempotent, so a
  // restart or a foreground return never schedules a duplicate.
  useEffect(() => {
    reconcileMotivationNotifications();
    accountabilityAppOpened();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        reconcileMotivationNotifications();
        accountabilityAppOpened();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navRouter = useRouter();
  usePresenceTracker();

  // Android back gesture from any non-Home page returns to Home.
  useEffect(() => {
    (window as unknown as { CommitXNav?: { goHome: () => void } }).CommitXNav = {
      goHome: () => void navRouter.navigate({ to: "/" }),
    };
  }, [navRouter]);


  // The sculptural botanical theme belongs to the installed CommitX app only.
  // Scoping it on body keeps every public website route visually unchanged.
  useEffect(() => {
    if (!hasNativeBridge()) return;
    document.body.classList.add("cx-app-theme");
    return () => document.body.classList.remove("cx-app-theme");
  }, []);

  // Offline support: registers the generated worker in published production only.
  useEffect(() => {
    registerAppServiceWorker();
  }, []);

  // Website only. The Android app must never load ad code: AdSense is not
  // permitted inside apps, and the Play listing declares the app ad-free.
  // Loaded after hydration because injected <ins> elements otherwise mutate the
  // SSR HTML before React attaches.
  useEffect(() => {
    if (hasNativeBridge()) return;
    if (document.querySelector("script[data-commitx-ads]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.commitxAds = "1";
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4902262012947970";
    document.head.appendChild(s);

    // Monetag vignette (website only, never inside the Android app).
    if (document.querySelector("script[data-monetag-zone='11802810']")) return;
    const m = document.createElement("script");
    m.dataset.zone = "11802810";
    m.dataset.monetagZone = "11802810";
    m.src = "https://n6wxm.com/vignette.min.js";
    document.head.appendChild(m);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AmbientNature />
      <OfflineNotice />
      <VerifiedRecovery />
      <ActiveSessionRestore />
      <StudyReminders />
      <AuthGate>
        <Outlet />
      </AuthGate>
    </QueryClientProvider>
  );
}
