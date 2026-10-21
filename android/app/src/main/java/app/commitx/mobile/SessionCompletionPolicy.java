package app.commitx.mobile;

/** Notification eligibility only: never decides the recorded session outcome. */
final class SessionCompletionPolicy {
    static boolean shouldHandle(String phase, long endElapsed, long nowElapsed, boolean handled) {
        return !handled && "focus".equals(phase) && endElapsed > 0 && nowElapsed >= endElapsed;
    }
    static boolean shouldAlert(boolean viewingSession) { return !viewingSession; }
}