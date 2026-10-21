package app.commitx.mobile;

/** Device-independent timing/threshold rules used by the App Limits worker. */
final class AppLimitsPolicy {
    static final long POLL_MS = 300L;
    static final long USAGE_REFRESH_MS = 5000L;

    private AppLimitsPolicy() {}

    static int threshold(long usedMs, int minutes) {
        if (usedMs < 0L || minutes <= 0) return 0;
        long limitMs = minutes * 60000L;
        if (usedMs >= limitMs) return 100;
        return usedMs >= limitMs / 2L ? 50 : 0;
    }

    static boolean needsRefresh(long now, long lastRefresh, boolean changed) {
        return changed || lastRefresh == 0L || now < lastRefresh
                || now - lastRefresh >= USAGE_REFRESH_MS;
    }

    static boolean shouldHide(String foreground, String coveredPackage) {
        return foreground != null && !foreground.equals(coveredPackage);
    }
}