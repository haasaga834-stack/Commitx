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

            // Event-based accounting: only foreground time that actually happened
            // between local midnight and now is counted, so the day starts at 0:00
            // and grows strictly with real usage.
            long own = 0L;
            long other = 0L;
            boolean sawEvents = false;
            android.app.usage.UsageEvents events = usm.queryEvents(start, end);
            if (events != null) {
                java.util.HashMap<String, Long> open = new java.util.HashMap<>();
                android.app.usage.UsageEvents.Event e = new android.app.usage.UsageEvents.Event();
                while (events.hasNextEvent()) {
                    events.getNextEvent(e);
                    String pkg = e.getPackageName();
                    if (pkg == null) continue;
                    int type = e.getEventType();
                    if (type == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND) {
                        sawEvents = true;
                        open.put(pkg, Math.max(start, e.getTimeStamp()));
                    } else if (type == android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND) {
                        sawEvents = true;
                        Long from = open.remove(pkg);
                        long fromMs = from == null ? start : from;
                        long ms = Math.max(0L, Math.min(end, e.getTimeStamp()) - fromMs);
                        if (self.equals(pkg)) own += ms; else other += ms;
                    }
                }
                // Whatever is still in the foreground counts up to "now".
                for (Map.Entry<String, Long> en : open.entrySet()) {
                    long ms = Math.max(0L, end - Math.max(start, en.getValue()));
                    if (self.equals(en.getKey())) own += ms; else other += ms;
                }
            }

            if (!sawEvents) {
                Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(start, end);
                if (stats == null || stats.isEmpty()) return null;
                own = 0L;
                other = 0L;
                for (Map.Entry<String, UsageStats> en : stats.entrySet()) {
                    UsageStats s = en.getValue();
                    if (s == null) continue;
                    long ms = s.getTotalTimeInForeground();
                    if (ms <= 0) continue;
                    if (self.equals(en.getKey())) own += ms;
                    else other += ms;
                }
            }

            // Never report more than the wall-clock time elapsed since midnight.
            long elapsed = Math.max(0L, end - start);
            own = Math.min(own, elapsed);
            other = Math.min(other, elapsed);
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
