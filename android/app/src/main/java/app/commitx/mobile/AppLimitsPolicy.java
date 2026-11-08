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

    /** "30m daily limit", "1h 30m daily limit" or "60 reels daily limit" (reels are stored as ~30s each). */
    static String formatLimit(int minutes, String type) {
        if (minutes <= 0) return "";
        if ("reels".equals(type)) return (minutes * 2) + " reels daily limit";
        int h = minutes / 60;
        int m = minutes % 60;
        String amount = h == 0 ? m + "m" : (m == 0 ? h + "h" : h + "h " + m + "m");
        return amount + " daily limit";
    }

    /** Live countdown to the midnight reset: "3h 14m 05s", "14m 05s" or "05s". */
    static String formatResetIn(long remainingMs) {
        long total = Math.max(0L, remainingMs) / 1000L;
        long h = total / 3600L;
        long m = (total % 3600L) / 60L;
        long s = total % 60L;
        String ss = (s < 10 ? "0" : "") + s + "s";
        if (h > 0) return h + "h " + (m < 10 ? "0" : "") + m + "m " + ss;
        if (m > 0) return m + "m " + ss;
        return ss;
    }

    static boolean shouldHide(String foreground, String coveredPackage) {
        return foreground != null && !foreground.equals(coveredPackage);
    }
}