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
import {
  finalizePendingVerifiedFailure,
  readActiveVerifiedSession,
} from "../lib/verified-mode";

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
      <head>
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <VerifiedRecovery />
      <Outlet />
    </QueryClientProvider>
  );
}
