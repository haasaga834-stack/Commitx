/**
 * Notification and widget taps open CommitX pages directly (Screen Time,
 * Planner, ...). While a focus session is running those taps must never pull
 * the student off the timer — that was a way out of a locked session.
 */
const ALLOWED_DURING_SESSION = new Set(["/session", "/success", "/failed"]);

export function isAllowedDuringSession(target: string): boolean {
  const path = (String(target || "/").split("?")[0] || "/").replace(/\/+$/, "") || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return ALLOWED_DURING_SESSION.has(normalized.toLowerCase());
}
