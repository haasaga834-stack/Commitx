// Recovers screens that fail to load their code (weak network, or an older
// saved copy of the app asking for files replaced by a newer publish). Without
// this, the app could freeze half-way through opening a page.

const GUARD_KEY = "commitx-chunk-reload-at";
const GUARD_MS = 20_000;

export function isChunkLoadError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : String((error as { message?: unknown } | null)?.message ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS/i.test(
    text,
  );
}

/** Reloads fresh once; returns false when a reload already happened very recently. */
export function recoverFromChunkError(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0);
    if (last && now - last < GUARD_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(now));
  } catch {
    /* storage unavailable: still try once */
  }
  const bridge = (window as unknown as { CommitXAndroid?: { reloadFresh?: () => void } })
    .CommitXAndroid;
  try {
    if (bridge?.reloadFresh) {
      bridge.reloadFresh();
      return true;
    }
  } catch {
    /* fall through to a normal reload */
  }
  window.location.reload();
  return true;
}

let installed = false;
export function installChunkRecovery(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    recoverFromChunkError();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) recoverFromChunkError();
  });
}

// The Android app sometimes opened a page without its phone connection
// (window.CommitXAndroid). Screens then thought they were in the app but every
// phone feature silently did nothing until the app was killed. Reload so the
// connection is attached again.
const BRIDGE_GUARD_KEY = "commitx-bridge-reloads";
const BRIDGE_WINDOW_MS = 60_000;
const BRIDGE_MAX_RELOADS = 2;

/** Decides whether another bridge-recovery reload is allowed; returns the new attempt log or null. */
export function nextBridgeReload(log: number[], now: number): number[] | null {
  const recent = log.filter((t) => now - t < BRIDGE_WINDOW_MS);
  if (recent.length >= BRIDGE_MAX_RELOADS) return null;
  return [...recent, now];
}

let bridgeWatchInstalled = false;
export function installBridgeRecovery(): void {
  if (bridgeWatchInstalled || typeof window === "undefined") return;
  bridgeWatchInstalled = true;
  const w = window as unknown as { CommitXAndroid?: unknown };
  let wasApp = false;
  try {
    wasApp = localStorage.getItem("cx_is_native") === "1" && /Android/i.test(navigator.userAgent);
  } catch {
    return;
  }
  if (!wasApp || w.CommitXAndroid) return;
  window.setTimeout(() => {
    if (w.CommitXAndroid) return;
    let log: number[] = [];
    try { log = JSON.parse(sessionStorage.getItem(BRIDGE_GUARD_KEY) ?? "[]"); } catch { log = []; }
    const next = nextBridgeReload(Array.isArray(log) ? log : [], Date.now());
    if (!next) return;
    try { sessionStorage.setItem(BRIDGE_GUARD_KEY, JSON.stringify(next)); } catch {}
    window.location.reload();
  }, 1200);
}
