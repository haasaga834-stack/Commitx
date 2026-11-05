package app.commitx.mobile;

import java.util.HashMap;
import java.util.Map;

/** Clips a reconstructed foreground timeline to the requested day. */
final class UsageTimeline {
    final Map<String, Long> totals = new HashMap<>();
    private final long start, end, hourBase;
    private final long[] hourly;
    private String current;
    private long from;

    UsageTimeline(long start, long end, long[] hourly, long hourBase) {
        this.start = start; this.end = end; this.hourly = hourly; this.hourBase = hourBase;
    }

    void event(int type, String pkg, long timestamp) {
        long ts = Math.min(end, timestamp);
        if (type == 17 || type == 15 || type == 26) { close(ts); current = null; return; }
        if (pkg == null) return;
        if (type == 1) { close(ts); current = pkg; from = Math.max(start, ts); }
        else if (type == 2 && pkg.equals(current)) { close(ts); current = null; }
    }

    Map<String, Long> finish() { close(end); current = null; return totals; }
    String currentPackage() { return current; }

    private void close(long to) {
        if (current == null) return;
        long begin = Math.max(start, from), finish = Math.min(end, to);
        if (finish <= begin) return;
        totals.put(current, totals.getOrDefault(current, 0L) + finish - begin);
        if (hourly != null) {
            for (long t = begin; t < finish;) {
                int h = (int) ((t - hourBase) / 3_600_000L);
                if (h < 0 || h >= hourly.length) break;
                long next = Math.min(finish, hourBase + (h + 1) * 3_600_000L);
                hourly[h] += next - t; t = next;
            }
        }
        from = finish;
    }
}