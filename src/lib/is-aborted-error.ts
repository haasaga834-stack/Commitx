// A cancelled/aborted HTTP request (client reload, fast navigation, closed tab)
// is not an application error — it must never be logged or reported.
export function isAbortedError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };
    if (e.code === "ECONNRESET" || e.code === "ABORT_ERR") return true;
    if (e.name === "AbortError") return true;
    if (typeof e.message === "string" && /^aborted$|ECONNRESET|aborted/i.test(e.message)) return true;
    current = e.cause;
  }
  return false;
}
