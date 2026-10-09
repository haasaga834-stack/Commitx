package app.commitx.mobile;

/** Run with javac/java; assertions do not need an Android device. */
public final class VerifiedCountdownClockTest {
    private static void equal(Object actual, Object expected) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    public static void main(String[] args) {
        equal(VerifiedCountdownClock.format(3600000), "01:00:00");
        equal(VerifiedCountdownClock.format(599000), "00:09:59");
        equal(VerifiedCountdownClock.format(1), "00:00:01");
        equal(VerifiedCountdownClock.format(-1000), "00:00:00");
        equal(VerifiedCountdownClock.remaining(3600000, 300000), 3300000L);
        equal(VerifiedCountdownClock.remaining(3600000, 3605000), 0L);
        // Simulates process suspension: no tick counts needed to catch up.
        equal(VerifiedCountdownClock.remaining(3600000, 3599000), 1000L);
        System.out.println("7 native countdown assertions passed");
    }
}