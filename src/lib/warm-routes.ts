// Preload every in-app screen's code once, in idle time, after sign-in.
// Navigation then never waits on a network chunk fetch, and screens the user
// has not opened yet still work offline (Android WebView cache / site worker).
import type { AnyRouter } from "@tanstack/react-router";

const APP_ROUTES = [
  "/", "/planner", "/profile", "/analytics", "/history", "/settings",
  "/wallet", "/screen-time", "/commit", "/session", "/standard-focus",
  "/verified-focus", "/focus-timer", "/success", "/failed", "/group",
  "/academics",
] as const;

let warmed = false;

export function warmAppRoutes(router: AnyRouter): void {
  if (warmed || typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  warmed = true;
  const idle: (cb: () => void) => void =
    (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ??
    ((cb) => window.setTimeout(cb, 1500));
  let i = 0;
  const next = () => {
    if (i >= APP_ROUTES.length) return;
    const to = APP_ROUTES[i++];
    // Code only — loaders stay lazy so no extra data is fetched.
    Promise.resolve()
      .then(() => (router as unknown as { loadRouteChunk?: unknown; preloadRoute: (o: { to: string }) => Promise<unknown> })
        .preloadRoute({ to }))
      .catch(() => {})
      .finally(() => idle(next));
  };
  window.setTimeout(() => idle(next), 2500);
}
