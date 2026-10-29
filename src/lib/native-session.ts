/**
 * Thin, safe wrappers around the native Android bridge used by sessions.
 * Every call is a no-op on the web where the bridge is absent.
 */
declare global {
  interface Window {
    CommitXAndroid?: {
      setVerifiedModeActive?: (active: boolean) => void;
      setSessionLockActive?: (active: boolean) => void;
      setAtRootScreen?: (atRoot: boolean) => void;
      shareText?: (title: string, text: string) => void;
      clearPendingFailure?: () => void;
      hasNativeGoogleSignIn?: () => boolean;
      googleSignIn?: () => void;
      googleSignOut?: () => void;
      isDndEnabled?: () => boolean;
      openDndSettings?: () => void;
      canCheckDnd?: () => boolean;
      /* Notification permission */
      notificationsEnabled?: () => boolean;
      requestNotificationPermission?: () => void;
      openNotificationSettings?: () => void;
      /* Notifications */
      syncTodos?: (itemsJson: string) => void;
      clearTodoNotification?: () => void;
      syncStudyPlans?: (plansJson: string) => void;
      setPlanRemindersEnabled?: (on: boolean) => void;
      setMotivationNotifications?: (on: boolean) => void;
      reconcileMotivationNotifications?: () => void;

      showSessionProgress?: (title: string, text: string, progress: number) => void;
      hideSessionProgress?: () => void;
      syncVerifiedCountdown?: (payloadJson: string) => void;
      syncStandardCountdown?: (payloadJson: string) => void;
      syncStudyWidget?: (payloadJson: string) => void;
      requestStudyWidget?: () => boolean;
      studyWidgetInvitationSeen?: (userId: string) => boolean;
      markStudyWidgetInvited?: (userId: string) => void;
      pendingStudyWidgetTodos?: () => string;
      ackStudyWidgetTodos?: (payloadJson: string) => void;
      finishVerifiedCountdown?: (status: string) => void;
      finishStandardCountdown?: (status: string) => void;
      scheduleWellnessSound?: (eventKey: string, kind: string, fireAtMs: number) => void;
      playWellnessSound?: (eventKey: string, kind: string) => void;
      cancelWellnessSounds?: (sessionPrefix: string) => void;
      /* Screen time */
      screenTimeSupported?: () => boolean;
      hasUsageAccess?: () => boolean;
      openUsageAccessSettings?: () => void;
      screenTimeToday?: () => string;
      screenTimeDetails?: () => string;
      screenTimeLimit?: () => number;
      setScreenTimeLimit?: (minutes: number) => void;
      rateApp?: () => void;
      /* Focus Shield (Standard mode only, native Android) */
      focusShieldSupported?: () => boolean;
      focusShieldHasUsageAccess?: () => boolean;
      focusShieldHasOverlayAccess?: () => boolean;
      requestFocusShieldOverlayAccess?: () => void;
      focusShieldApps?: () => string;
      preloadFocusShieldApps?: () => void;
      focusShieldStart?: (packagesJson: string, endsAtMs: number) => boolean;
      focusShieldStop?: () => void;
      focusShieldActive?: () => boolean;
      /* App Usage Limits (daily per-app limits, independent of Focus Shield) */
      appLimitsSupported?: () => boolean;
      appLimitsJson?: () => string;
      setAppLimit?: (pkg: string, type: string, minutes: number) => void;
      removeAppLimit?: (pkg: string) => void;


    };
    CommitXSession?: {
      onAndroidBack?: () => void;
    };
    CommitXTodos?: {
      toggleFromNative?: (id: string) => void;
    };
    CommitXNotifications?: {
      onPermissionResult?: (granted: boolean) => void;
    };

  }
}

const NATIVE_FLAG = "cx_is_native";

/**
 * True inside the Android app. Remembered per WebView storage so a reconnect
 * reload that races bridge injection never renders the public website.
 * WebView storage is separate from browsers, so the website is unaffected.
 */
export function hasNativeBridge() {
  if (typeof window === "undefined") return false;
  try {
    if (window.CommitXAndroid) {
      window.localStorage.setItem(NATIVE_FLAG, "1");
      return true;
    }
    return window.localStorage.getItem(NATIVE_FLAG) === "1" && /Android/i.test(navigator.userAgent);
  } catch {
    return !!window.CommitXAndroid;
  }
}

export function setNativeSessionLock(active: boolean) {
  try {
    window.CommitXAndroid?.setSessionLockActive?.(active);
  } catch {}
}

/**
 * Tells the native shell whether Home (the root destination) is showing, so the
 * Android back gesture minimises the app instead of walking WebView history.
 */
export function setNativeAtRootScreen(atRoot: boolean) {
  try {
    window.CommitXAndroid?.setAtRootScreen?.(atRoot);
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

/* Dialogs that the Android Back gesture should close before leaving the page. */
const nativeModalStack: Array<() => void> = [];

export function hasOpenNativeModal() {
  return nativeModalStack.length > 0;
}

/** Registers an open dialog; returns an unregister function. */
export function registerNativeModal(close: () => void) {
  nativeModalStack.push(close);
  setNativeAtRootScreen(false);
  return () => {
    const i = nativeModalStack.lastIndexOf(close);
    if (i >= 0) nativeModalStack.splice(i, 1);
    if (typeof window !== "undefined") {
      setNativeAtRootScreen(window.location.pathname === "/" && nativeModalStack.length === 0);
    }
  };
}

/** Closes the top dialog; true when one was closed. */
export function closeTopNativeModal() {
  const close = nativeModalStack[nativeModalStack.length - 1];
  if (!close) return false;
  close();
  return true;
}
