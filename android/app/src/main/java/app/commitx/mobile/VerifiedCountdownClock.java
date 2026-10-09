package app.commitx.mobile;

import java.util.Locale;

/** Pure notification clock; never writes session results or coins. */
final class VerifiedCountdownClock {
    static long remaining(long endElapsed, long nowElapsed) {
        return Math.max(0, endElapsed - nowElapsed);
    }

    static String format(long millis) {
        long seconds = Math.max(0, (millis + 999) / 1000);
        return String.format(Locale.ROOT, "%02d:%02d:%02d",
                seconds / 3600, (seconds % 3600) / 60, seconds % 60);
    }
}