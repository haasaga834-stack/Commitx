/**
 * Thin, safe wrappers around the native Android bridge used by sessions.
 * Every call is a no-op on the web where the bridge is absent.
 */
declare global {
  interface Window {
    CommitXAndroid?: {
      setVerifiedModeActive?: (active: boolean) => void;
      setSessionLockActive?: (active: boolean) => void;
      clearPendingFailure?: () => void;
      hasNativeGoogleSignIn?: () => boolean;
      googleSignIn?: () => void;
      googleSignOut?: () => void;
      isDndEnabled?: () => boolean;
      openDndSettings?: () => void;
      canCheckDnd?: () => boolean;
      /* Notifications */
      syncTodos?: (itemsJson: string) => void;
      clearTodoNotification?: () => void;
      showSessionProgress?: (title: string, text: string, progress: number) => void;
      hideSessionProgress?: () => void;
      /* Screen time */
      screenTimeSupported?: () => boolean;
      hasUsageAccess?: () => boolean;
      openUsageAccessSettings?: () => void;
      screenTimeToday?: () => string;
      screenTimeLimit?: () => number;
      setScreenTimeLimit?: (minutes: number) => void;
    };
    CommitXSession?: {
      onAndroidBack?: () => void;
    };
    CommitXTodos?: {
      toggleFromNative?: (id: string) => void;
    };
  }
}

export function hasNativeBridge() {
  return typeof window !== "undefined" && !!window.CommitXAndroid;
}

export function setNativeSessionLock(active: boolean) {
  try {
    window.CommitXAndroid?.setSessionLockActive?.(active);
  } catch {}
}

export function setNativeVerifiedModeActive(active: boolean) {
  try {
    window.CommitXAndroid?.setVerifiedModeActive?.(active);
    if (!active) window.CommitXAndroid?.clearPendingFailure?.();
  } catch {}
}

/** True when the platform can report Do Not Disturb state at all. */
export function canCheckDnd() {
  try {
    return Boolean(window.CommitXAndroid?.canCheckDnd?.());
  } catch {
    return false;
  }
}

/** null = unknown (web / unsupported), otherwise the current DND state. */
export function isDndEnabled(): boolean | null {
  if (!canCheckDnd()) return null;
  try {
    return Boolean(window.CommitXAndroid?.isDndEnabled?.());
  } catch {
    return null;
  }
}

export function openDndSettings() {
  try {
    window.CommitXAndroid?.openDndSettings?.();
  } catch {}
}
