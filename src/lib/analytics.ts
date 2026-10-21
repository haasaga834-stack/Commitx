/**
 * Product analytics + crash reporting (PostHog). Fully inert until the
 * PostHog connector provides a project token, and never sends goal text,
 * emails, names or any study content — only event names and coarse buckets.
 */
type Props = Record<string, string | number | boolean | null>;

let client: { capture: (e: string, p?: Props) => void; identify: (id: string) => void; reset: () => void; captureException?: (e: unknown, p?: Props) => void } | null = null;
let starting: Promise<void> | null = null;
const queue: Array<[string, Props | undefined]> = [];
let pendingUser: string | null | undefined;

function token(): string | undefined {
  return import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY as string | undefined;
}

export function durationBucket(minutes: number): string {
  if (minutes < 30) return "<30m";
  if (minutes < 60) return "30-59m";
  if (minutes < 90) return "60-89m";
  if (minutes < 120) return "90-119m";
  return "120m+";
}

export function initAnalytics() {
  if (typeof window === "undefined" || client || starting || !token()) return;
  starting = import("posthog-js")
    .then(({ default: posthog }) => {
      const region = (import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_REGION as string) || "eu";
      posthog.init(token()!, {
        api_host: region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        autocapture: false,
        disable_session_recording: true,
        capture_exceptions: true,
      });
      posthog.register({ platform: (window as { CommitXNative?: unknown }).CommitXNative ? "android" : "web" });
      client = posthog as unknown as typeof client;
      if (pendingUser) client!.identify(pendingUser);
      queue.splice(0).forEach(([e, p]) => client!.capture(e, p));
    })
    .catch(() => {
      starting = null;
    });
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message, { kind: "window_error" }));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason, { kind: "unhandled_rejection" }));
}

export function track(event: string, props?: Props) {
  if (typeof window === "undefined" || !token()) return;
  if (client) client.capture(event, props);
  else if (queue.length < 50) queue.push([event, props]);
}

export function reportError(error: unknown, props?: Props) {
  if (!client) return;
  try {
    if (client.captureException) client.captureException(error, props);
    else client.capture("$exception", { message: String(error), ...props });
  } catch {
    /* never let reporting break the app */
  }
}

export function identifyUser(userId: string | null) {
  pendingUser = userId;
  if (!client) return;
  if (userId) client.identify(userId);
  else client.reset();
}
