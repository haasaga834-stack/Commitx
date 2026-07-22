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
import { reportLovableError } from "../lib/lovable-error-reporting";

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
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
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
      { name: "theme-color", content: "#F8F9F6" },
      { title: "CommitX — Home" },
      {
        name: "description",
        content:
          "Start a focused commitment. One promise at a time, kept beautifully.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "CommitX — Home" },
      {
        property: "og:description",
        content:
          "Start a focused commitment. One promise at a time, kept beautifully.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CommitX — Home" },
      {
        name: "twitter:description",
        content:
          "Start a focused commitment. One promise at a time, kept beautifully.",
      },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cd137564-7ced-4ecf-9182-ce46fefd617d/id-preview-b57e91a0--1384a4d2-7b53-476d-badb-4dfc999cef26.lovable.app-1784650045741.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cd137564-7ced-4ecf-9182-ce46fefd617d/id-preview-b57e91a0--1384a4d2-7b53-476d-badb-4dfc999cef26.lovable.app-1784650045741.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap",
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const ACTIVE_KEY = "commitx-active-session-v1";
const CALL_GRACE_MS = 8000;

function VerifiedRecovery() {
  const router = useRouter();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      if (!raw) return;
      const prev = JSON.parse(raw);
      if (prev?.mode !== "verified") return;
      const hiddenTooLong =
        typeof prev.hiddenAt === "number" && Date.now() - prev.hiddenAt > CALL_GRACE_MS;
      if (!prev.pendingFail && !hiddenTooLong) return;

      // Persist the failed session and clear active marker.
      import("../lib/commitx-store").then(({ setState }) => {
        setState((s) => ({
          ...s,
          sessions: [
            {
              id: `${Date.now()}`,
              goal: prev.goal,
              durationMinutes: prev.duration,
              value: prev.value,
              mode: "verified",
              status: "failed",
              date: Date.now(),
            },
            ...s.sessions,
          ],
          balance: s.balance - (prev.value || 0),
        }));
      });
      localStorage.removeItem(ACTIVE_KEY);
      const reason = prev.pendingFail ? prev.reason || "killed" : "background";
      // eslint-disable-next-line no-console
      console.log("[CommitX lifecycle] Session Failed", { reason, recovered: true });
      if (router.state.location.pathname !== "/failed") {
        router.navigate({
          to: "/failed",
          search: {
            goal: String(prev.goal ?? "Focus"),
            duration: String(prev.duration ?? 0),
            value: String(prev.value ?? 0),
            reason,
          } as Record<string, string>,
        });
      }
    } catch {}
  }, [router]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <VerifiedRecovery />
      <Outlet />
    </QueryClientProvider>
  );
}
