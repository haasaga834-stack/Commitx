package app.commitx.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Map;

/**
 * Daily screen time via Android Usage Access. Reports CommitX time and
 * "other apps" time separately, and alerts once per day when the user's
 * limit for other apps is reached. Values reset naturally each day because
 * every query starts at local midnight.
 */
final class ScreenTimeTracker {
    private static final String PREFS = "commitx_screen_time";
    private static final String KEY_LIMIT = "limit_minutes";
    private static final String KEY_NOTIFIED_DAY = "notified_day";
    private static final long CHECK_INTERVAL_MS = 10 * 60 * 1000L;

    private ScreenTimeTracker() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean supported() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1;
    }

    static boolean hasPermission(Context ctx) {
        if (!supported()) return false;
        try {
            return totals(ctx, true) != null;
        } catch (Throwable t) {
            return false;
        }
    }

    static long startOfToday() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    static String dayKey() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.YEAR) + "-" + c.get(Calendar.MONTH) + "-" + c.get(Calendar.DAY_OF_MONTH);
    }

    /** [commitxMinutes, otherMinutes] for today, or null when access is missing. */
    static int[] totals(Context ctx, boolean quiet) {
        if (!supported()) return null;
        try {
            UsageStatsManager usm =
                    (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return null;
            long start = startOfToday();
            long end = System.currentTimeMillis();
            String self = ctx.getPackageName();

            // Single-foreground timeline: Android only ever has one app in the
            // foreground, so we walk today's events in order and attribute each
            // slice of wall-clock time to exactly one package. This makes the
            // day start at 0:00 and grow strictly with real usage, and makes it
            // impossible for the total to exceed the time elapsed since midnight.
            long own = 0L;
            long other = 0L;
            boolean sawEvents = false;
            String currentPkg = null;
            long currentFrom = 0L;
            boolean screenOff = false;

            android.app.usage.UsageEvents events = usm.queryEvents(start, end);
            if (events != null) {
                android.app.usage.UsageEvents.Event e = new android.app.usage.UsageEvents.Event();
                while (events.hasNextEvent()) {
                    events.getNextEvent(e);
                    int type = e.getEventType();
                    long ts = Math.min(end, Math.max(start, e.getTimeStamp()));
                    String pkg = e.getPackageName();

                    // Screen off / keyguard: stop counting until something resumes.
                    if (type == 17 /* SCREEN_NON_INTERACTIVE */ || type == 15 /* KEYGUARD_SHOWN */) {
                        if (currentPkg != null) {
                            long ms = Math.max(0L, ts - currentFrom);
                            if (self.equals(currentPkg)) own += ms; else other += ms;
                            currentPkg = null;
                        }
                        screenOff = true;
                        continue;
                    }
                    if (type == 16 /* SCREEN_INTERACTIVE */ || type == 18 /* KEYGUARD_HIDDEN */) {
                        screenOff = false;
                        continue;
                    }

                    if (pkg == null) continue;

                    if (type == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND) {
                        sawEvents = true;
                        screenOff = false;
                        if (currentPkg != null) {
                            long ms = Math.max(0L, ts - currentFrom);
                            if (self.equals(currentPkg)) own += ms; else other += ms;
                        }
                        currentPkg = pkg;
                        currentFrom = ts;
                    } else if (type == android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND) {
                        sawEvents = true;
                        // Only close the interval we actually opened today; a
                        // stray background event with no matching foreground is
                        // ignored instead of being billed from midnight.
                        if (currentPkg != null && currentPkg.equals(pkg)) {
                            long ms = Math.max(0L, ts - currentFrom);
                            if (self.equals(pkg)) own += ms; else other += ms;
                            currentPkg = null;
                        }
                    }
                }
                // Whatever is still in the foreground right now counts up to "now".
                if (currentPkg != null && !screenOff) {
                    long ms = Math.max(0L, end - currentFrom);
                    if (self.equals(currentPkg)) own += ms; else other += ms;
                }
            }

            long elapsed = Math.max(0L, end - start);

            if (!sawEvents) {
                Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(start, end);
                if (stats == null || stats.isEmpty()) return null;
                own = 0L;
                other = 0L;
                for (Map.Entry<String, UsageStats> en : stats.entrySet()) {
                    UsageStats s = en.getValue();
                    if (s == null) continue;
                    long ms = Math.min(elapsed, s.getTotalTimeInForeground());
                    if (ms <= 0) continue;
                    if (self.equals(en.getKey())) own += ms;
                    else other += ms;
                }
                // Aggregated stats can double-count overlapping windows; scale the
                // pair down so the combined total never beats the clock.
                long total = own + other;
                if (total > elapsed && total > 0) {
                    own = own * elapsed / total;
                    other = other * elapsed / total;
                }
            }

            // Final safety net: never report more than today's wall clock.
            own = Math.min(own, elapsed);
            other = Math.min(other, Math.max(0L, elapsed - own));

            return new int[] { (int) (own / 60000L), (int) (other / 60000L) };
        } catch (Throwable t) {
            if (!quiet) t.printStackTrace();
            return null;
        }
    }


    static int limitMinutes(Context ctx) {
        return prefs(ctx).getInt(KEY_LIMIT, 0);
    }

    static void setLimitMinutes(Context ctx, int minutes) {
        prefs(ctx).edit()
                .putInt(KEY_LIMIT, Math.max(0, minutes))
                .remove(KEY_NOTIFIED_DAY)
                .apply();
        if (minutes > 0) scheduleChecks(ctx);
    }

    /** JSON payload consumed by the web layer. */
    static String toJson(Context ctx) {
        JSONObject o = new JSONObject();
        try {
            int[] t = totals(ctx, true);
            o.put("supported", supported());
            o.put("granted", t != null);
            o.put("commitxMinutes", t == null ? 0 : t[0]);
            o.put("otherMinutes", t == null ? 0 : t[1]);
            o.put("limitMinutes", limitMinutes(ctx));
            o.put("day", dayKey());
        } catch (Throwable ignored) {}
        return o.toString();
    }

    static String format(int minutes) {
        int m = Math.max(0, minutes);
        if (m < 60) return m + "m";
        return (m / 60) + "h " + (m % 60) + "m";
    }

    static void scheduleChecks(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(ctx, ScreenTimeReceiver.class)
                    .setAction(ScreenTimeReceiver.ACTION_CHECK);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 200, intent, flags);
            am.setInexactRepeating(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + CHECK_INTERVAL_MS,
                    CHECK_INTERVAL_MS,
                    pi);
        } catch (Throwable ignored) {}
    }

    /** Notifies at most once per day when the limit for other apps is passed. */
    static void checkLimit(Context ctx) {
        int limit = limitMinutes(ctx);
        if (limit <= 0) return;
        int[] t = totals(ctx, true);
        if (t == null) return;
        if (t[1] < limit) return;
        String today = dayKey();
        if (today.equals(prefs(ctx).getString(KEY_NOTIFIED_DAY, null))) return;
        prefs(ctx).edit().putString(KEY_NOTIFIED_DAY, today).apply();
        CommitXNotifications.showScreenTimeLimit(ctx, t[1], limit);
    }
}
