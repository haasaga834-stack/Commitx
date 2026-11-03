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
