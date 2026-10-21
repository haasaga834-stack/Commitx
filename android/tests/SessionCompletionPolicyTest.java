package app.commitx.mobile;

public final class SessionCompletionPolicyTest {
    private static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    public static void main(String[] args) {
        check(!SessionCompletionPolicy.shouldHandle("focus", 7200000, 7199999, false));
        check(SessionCompletionPolicy.shouldHandle("focus", 7200000, 7200000, false));
        check(SessionCompletionPolicy.shouldHandle("focus", 7200000, 10800000, false));
        check(!SessionCompletionPolicy.shouldHandle("focus", 7200000, 10800000, true));
        check(!SessionCompletionPolicy.shouldHandle("recovery_break", 7200000, 10800000, false));
        check(!SessionCompletionPolicy.shouldHandle("awaiting_confirmation", 7200000, 10800000, false));
        check(!SessionCompletionPolicy.shouldHandle("focus", 0, 10800000, false));
        check(SessionCompletionPolicy.shouldAlert(false));
        check(!SessionCompletionPolicy.shouldAlert(true));
        System.out.println("9 completion deadline assertions passed");
    }
}