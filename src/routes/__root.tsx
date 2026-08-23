import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
} from "../lib/verified-mode";
import { releaseActiveDbSession } from "../lib/active-session";
import { useAuth } from "../lib/use-auth";
import { useStudyReminders } from "../lib/planner";
import { reconcileMotivationNotifications } from "../lib/native-notifications";
import { AmbientNature } from "../components/AmbientNature";
import { Onboarding } from "../components/Onboarding";
import { useOnboarding } from "../lib/onboarding";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
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
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "module",
        children:
          "if(\"serviceWorker\"in navigator){window.addEventListener(\"load\",()=>{navigator.serviceWorker.register(\"/sw.js\").catch(()=>{})});}",
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
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4902262012947970"
          crossOrigin="anonymous"
        />
        <HeadContent />
        <script

          dangerouslySetInnerHTML={{
            __html:
              "try{var m=localStorage.getItem('commitx-theme-v1');if(m==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}",
          }}
        />
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
      // eslint-disable-next-line no-console
      console.log("[CommitX lifecycle] Session Failed", {
        reason: failure.reason,
        recovered: true,
      });
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

    window.addEventListener("commitx:verified-pending-failure", onNativePendingFailure);
    return () => {
      window.removeEventListener("commitx:verified-pending-failure", onNativePendingFailure);
    };
  }, [router]);
  return null;
}

function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const pathname = router.state.location.pathname;
  const { needsOnboarding, complete } = useOnboarding(user?.id ?? null);


  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/auth") {
      router.navigate({ to: "/auth" });
    }
    if (user && pathname === "/auth") {
      router.navigate({ to: "/" });
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
      </div>
    );
  }

  if (!user && pathname !== "/auth") return null;
  return (
    <>
      {children}
      {user && pathname !== "/auth" && needsOnboarding ? (
        <Onboarding onDone={() => void complete()} />
      ) : null}
    </>
  );
}

function StudyReminders() {
  useStudyReminders();
  // Re-arms the native 8:00 AM / 7:00 PM motivation alarms; idempotent, so a
  // restart or a foreground return never schedules a duplicate.
  useEffect(() => {
    reconcileMotivationNotifications();
    const onVisible = () => {
      if (document.visibilityState === "visible") reconcileMotivationNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AmbientNature />
      <VerifiedRecovery />
      <StudyReminders />
      <AuthGate>
        <Outlet />
      </AuthGate>
    </QueryClientProvider>
  );
}
