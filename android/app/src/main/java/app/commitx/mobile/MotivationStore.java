package app.commitx.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;
import java.util.Random;

/**
 * Daily motivation notifications: one at 8:00 AM and one at 7:00 PM, in the
 * device's local timezone, delivered by exact alarms so they arrive even when
 * CommitX is closed.
 *
 * Morning and evening use separate message pools, so an evening notification
 * can never carry a "Good Morning" title. The message for a calendar day and
 * slot is picked once and persisted, so restarts, rebuilds, logins and
 * background/foreground transitions never change or duplicate a notification.
 */
final class MotivationStore {
    private static final String PREFS = "commitx_motivation";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_DAY_MORNING_PREFIX = "day2_m_";  // day2_m_YYYY_MM_DD -> index
    private static final String KEY_DAY_EVENING_PREFIX = "day2_e_";  // day2_e_YYYY_MM_DD -> index
    private static final String KEY_LAST_MORNING = "last_m";         // avoid immediate repetition
    private static final String KEY_LAST_EVENING = "last_e";

    static final int MORNING_HOUR = 8;
    static final int EVENING_HOUR = 19;

    private static final int REQ_MORNING = 4101;
    private static final int REQ_EVENING = 4102;

    /** title \u0000 body — morning-only pool. */
    private static final String[] MORNING_MESSAGES = {
            "\uD83C\uDF05 Good Morning\u0000A new day, a fresh chance to move forward. One step at a time. \uD83C\uDF31\u2728",
            "\u2600\uFE0F Keep Going\u0000Small efforts every day create remarkable results. Keep showing up. \uD83D\uDCAA\uD83D\uDCDA",
            "\uD83C\uDF31 Keep Growing\u0000Progress doesn't need to be perfect. It just needs to continue. \uD83C\uDF3F",
            "\u2728 A Little Reminder\u0000Your goals are built one focused session at a time. Keep going. \uD83D\uDCDA",
            "\uD83D\uDCAB Stay Consistent\u0000You don't need to do everything today. Just take the next step. \uD83C\uDF31",
            "\uD83C\uDF3F One Step More\u0000Every focused hour is an investment in the person you're becoming. \u2728",
            "\uD83D\uDD25 Stay With It\u0000Some days are difficult. Showing up anyway is what makes the difference. \uD83D\uDCAA",
            "\uD83C\uDF24\uFE0F New Day, New Chance\u0000Start where you are and make this moment count. \uD83C\uDF31",
            "\uD83D\uDCD6 Keep Building\u0000Every page studied, every goal completed, brings you a little closer. \u2728",
            "\uD83C\uDF31 Trust the Process\u0000Growth takes time. Stay committed and let your effort compound. \u2728",
            "\uD83C\uDF33 Fresh Start\u0000Today's effort is tomorrow's confidence. Begin with one calm hour. \uD83C\uDF31\u2728",
            "\u2600\uFE0F Morning Momentum\u0000An hour now is lighter than a rushed night later. Choose the hour. \uD83D\uDCAA\uD83D\uDCDA",
    };

    /** title \u0000 body — evening-only pool. */
    private static final String[] EVENING_MESSAGES = {
            "\uD83C\uDF19 Good Evening\u0000You made it through another day. Keep building, one commitment at a time. \u2728",
            "\uD83C\uDF1F Be Proud\u0000Progress can be quiet, but every effort matters. Keep moving forward. \uD83C\uDF3F",
            "\uD83E\uDDD8 Take It One Step at a Time\u0000Stay present, stay patient, and keep moving toward your goal. \uD83C\uDF31",
            "\uD83D\uDE80 Your Future Is Built Today\u0000The small choices you make today shape where you go tomorrow. \u2728",
            "\uD83C\uDF19 Keep the Momentum\u0000Even a little progress today is better than standing still. Keep going. \uD83D\uDCAB",
            "\uD83C\uDF1B Evening Focus\u0000One focused hour tonight can change how tomorrow feels. \uD83D\uDCDA\u2728",
            "\uD83C\uDF05 Well Done Today\u0000Whatever you completed, showing up counts. Finish the day gently. \uD83C\uDF3F",
            "\uD83C\uDF0C End on a Good Note\u0000Close the day with one more honest effort. Your future self says thanks. \u2728",
            "\uD83C\uDF1A Wind Down\u0000A calm session now means a peaceful night and a stronger start tomorrow. \uD83C\uDF31",
            "\uD83C\uDF19 Tonight's Promise\u0000One commitment kept before bed is a quiet win worth keeping. \uD83D\uDCAB\u2728",
    };

    private MotivationStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean enabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_ENABLED, true);
    }

    /** Master on/off coming from the app's Notifications toggle. */
    static void setEnabled(Context ctx, boolean on) {
        prefs(ctx).edit().putBoolean(KEY_ENABLED, on).apply();
        if (on) reconcile(ctx);
        else cancelAll(ctx);
    }

    static String dayKey(Calendar c) {
        return String.format(
                java.util.Locale.US,
                "%04d_%02d_%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static String[] pool(boolean morning) {
        return morning ? MORNING_MESSAGES : EVENING_MESSAGES;
    }

    private static String dayKeyPrefix(boolean morning) {
        return morning ? KEY_DAY_MORNING_PREFIX : KEY_DAY_EVENING_PREFIX;
    }

    private static String lastIndexKey(boolean morning) {
        return morning ? KEY_LAST_MORNING : KEY_LAST_EVENING;
    }

    /** The persisted, stable message index for one slot on a day. */
    private static int indexFor(Context ctx, boolean morning, Calendar day) {
        String key = dayKeyPrefix(morning) + dayKey(day);
        String[] pool = pool(morning);
        SharedPreferences p = prefs(ctx);
        String stored = p.getString(key, null);
        if (stored != null) {
            try {
                int i = Integer.parseInt(stored);
                if (i >= 0 && i < pool.length) return i;
            } catch (Throwable ignored) {}
        }

        String last = p.getString(lastIndexKey(morning), "");
        Random rnd = new Random(System.currentTimeMillis() ^ key.hashCode());
        int i = rnd.nextInt(pool.length);
        // avoid the same message two days in a row
        if (String.valueOf(i).equals(last)) i = (i + 1) % pool.length;

        p.edit()
                .putString(key, String.valueOf(i))
                .putString(lastIndexKey(morning), String.valueOf(i))
                .apply();
        pruneOldDays(ctx, day);
        return i;
    }

    /** Drops persisted indexes older than a week so the prefs never grow. */
    private static void pruneOldDays(Context ctx, Calendar today) {
        try {
            SharedPreferences p = prefs(ctx);
            java.util.Set<String> keep = new java.util.HashSet<>();
            for (int i = -1; i <= 2; i++) {
                Calendar c = (Calendar) today.clone();
                c.add(Calendar.DAY_OF_YEAR, i);
                keep.add(KEY_DAY_MORNING_PREFIX + dayKey(c));
                keep.add(KEY_DAY_EVENING_PREFIX + dayKey(c));
            }
            SharedPreferences.Editor ed = p.edit();
            for (String k : p.getAll().keySet()) {
                if ((k.startsWith(KEY_DAY_MORNING_PREFIX) || k.startsWith(KEY_DAY_EVENING_PREFIX))
                        && !keep.contains(k)) ed.remove(k);
            }
            ed.apply();
        } catch (Throwable ignored) {}
    }

    static String titleFor(Context ctx, boolean morning, Calendar day) {
        String[] pool = pool(morning);
        return pool[indexFor(ctx, morning, day)].split("\u0000")[0];
    }

    static String bodyFor(Context ctx, boolean morning, Calendar day) {
        String[] pool = pool(morning);
        String[] parts = pool[indexFor(ctx, morning, day)].split("\u0000");
        return parts.length > 1 ? parts[1] : "";
    }

    /** Unique, stable notification id such as motivation_morning_2026_08_23. */
    static String notificationKey(boolean morning, Calendar day) {
        return (morning ? "motivation_morning_" : "motivation_evening_") + dayKey(day);
    }

    private static Calendar at(long from, int hour) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(from);
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c;
    }

    /** Next fire time for one slot, today if still ahead, else tomorrow. */
    static long nextFireAt(boolean morning) {
        long now = System.currentTimeMillis();
        Calendar c = at(now, morning ? MORNING_HOUR : EVENING_HOUR);
        if (c.getTimeInMillis() <= now) c.add(Calendar.DAY_OF_YEAR, 1);
        return c.getTimeInMillis();
    }

    /**
     * Re-arms both alarms (idempotent — FLAG_UPDATE_CURRENT replaces any
     * existing alarm, so opening the app can never create duplicates), and
     * pre-generates each slot's message for the day that alarm will land on.
     */
    static void reconcile(Context ctx) {
        if (!enabled(ctx)) {
            cancelAll(ctx);
            return;
        }
        arm(ctx, true);
        arm(ctx, false);
    }

    private static void arm(Context ctx, boolean morning) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            long fireAt = nextFireAt(morning);
            Calendar day = Calendar.getInstance();
            day.setTimeInMillis(fireAt);
            indexFor(ctx, morning, day); // persist the message up front

            PendingIntent pi = pending(ctx, morning, PendingIntent.FLAG_UPDATE_CURRENT);
            if (pi == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                // Exact-alarm access is off by default on Android 14+: fall back
                // to an inexact alarm instead of silently scheduling nothing.
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, fireAt, pi);
            }
        } catch (Throwable ignored) {}
    }

    private static PendingIntent pending(Context ctx, boolean morning, int extraFlags) {
        Intent intent = new Intent(ctx, MotivationReceiver.class)
                .setAction(MotivationReceiver.ACTION_MOTIVATION)
                .putExtra(MotivationReceiver.EXTRA_MORNING, morning);
        int flags = extraFlags
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(
                ctx, morning ? REQ_MORNING : REQ_EVENING, intent, flags);
    }

    static void cancelAll(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent m = pending(ctx, true, PendingIntent.FLAG_UPDATE_CURRENT);
            PendingIntent e = pending(ctx, false, PendingIntent.FLAG_UPDATE_CURRENT);
            if (m != null) am.cancel(m);
            if (e != null) am.cancel(e);
        } catch (Throwable ignored) {}
    }
}
