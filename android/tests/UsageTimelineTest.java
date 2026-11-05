package app.commitx.mobile;

public final class UsageTimelineTest {
    static void equal(long a, long b) { if (a != b) throw new AssertionError(a + " != " + b); }
    public static void main(String[] args) {
        long midnight = 86_400_000L;
        UsageTimeline carry = new UsageTimeline(midnight, midnight + 600_000L, null, 0);
        carry.event(1, "instagram", midnight - 60_000L);
        equal(carry.finish().get("instagram"), 600_000L);
        UsageTimeline locked = new UsageTimeline(midnight, midnight + 600_000L, null, 0);
        locked.event(1, "instagram", midnight - 60_000L);
        locked.event(17, null, midnight - 30_000L);
        equal(locked.finish().size(), 0);
        UsageTimeline stopped = new UsageTimeline(midnight, midnight + 600_000L, null, 0);
        stopped.event(1, "instagram", midnight - 60_000L);
        stopped.event(2, "instagram", midnight + 120_000L);
        equal(stopped.finish().get("instagram"), 120_000L);
        System.out.println("3 midnight usage assertions passed");
    }
}