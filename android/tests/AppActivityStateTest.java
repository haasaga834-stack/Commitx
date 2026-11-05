package app.commitx.mobile;

import java.util.Set;

public final class AppActivityStateTest {
    static void equal(Object actual, Object expected) {
        if (!java.util.Objects.equals(actual, expected)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    public static void main(String[] args) {
        AppActivityState s = new AppActivityState();
        Set<String> blocked = Set.of("instagram");
        equal(s.confirmed(), false);
        s.resume("instagram", "instagram:A");
        s.resume("instagram", "instagram:B");
        s.stop("instagram", "instagram:A");
        s.resume("launcher", "launcher:A");
        equal(s.blocked(blocked, "commitx"), "instagram");
        s.stop("instagram", "instagram:B");
        equal(s.blocked(blocked, "commitx"), null);
        s.resume("instagram", "instagram:B");
        s.stop("instagram", "instagram:B");
        equal(s.foreground(), null);
        equal(s.blocked(blocked, "commitx"), null);
        s.resume("instagram", "instagram:B");
        s.resume("commitx", "commitx:A");
        equal(s.blocked(blocked, "commitx"), null);
        System.out.println("6 activity lifecycle assertions passed");
    }
}