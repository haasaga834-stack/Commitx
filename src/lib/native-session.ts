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

export function hasNativeBridge() {
  return typeof window !== "undefined" && !!window.CommitXAndroid;
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
