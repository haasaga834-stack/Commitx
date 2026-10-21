package app.commitx.mobile;

/** Run with javac/java, without an Android device. */
public final class AppLimitsPolicyTest {
    private static void equal(Object actual, Object expected) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }

    public static void main(String[] args) {
        // Exhaustion covers the app at the exact limit, not a rounded next minute.
        equal(AppLimitsPolicy.threshold(60000L, 1), 100);
        equal(AppLimitsPolicy.threshold(59999L, 1), 50);
        // Half-time alert still begins at half the configured duration.
        equal(AppLimitsPolicy.threshold(30000L, 1), 50);
        equal(AppLimitsPolicy.threshold(29999L, 1), 0);
        equal(AppLimitsPolicy.threshold(-1L, 1), 0);
        // Faster foreground detection must not repeat daily aggregation every tick.
        equal(AppLimitsPolicy.POLL_MS, 300L);
        equal(AppLimitsPolicy.needsRefresh(1300L, 1000L, false), false);
        equal(AppLimitsPolicy.needsRefresh(6000L, 1000L, false), true);
        equal(AppLimitsPolicy.needsRefresh(1300L, 1000L, true), true);
        equal(AppLimitsPolicy.needsRefresh(1000L, 0L, false), true);
        // Unknown foreground never releases a cover; only confirmed app changes do.
        equal(AppLimitsPolicy.shouldHide(null, "com.instagram.android"), false);
        equal(AppLimitsPolicy.shouldHide("com.instagram.android", "com.instagram.android"), false);
        equal(AppLimitsPolicy.shouldHide("app.commitx.mobile", "com.instagram.android"), true);
        System.out.println("13 native App Limits assertions passed");
    }
}