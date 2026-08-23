package app.commitx.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * Local mirror of the study plans plus exact alarms that fire a reminder
 * 10 minutes before every planned session — also when the app is closed.
 */
final class PlanStore {
    private static final String PREFS = "commitx_plans";
    private static final String KEY_ITEMS = "items_json";
    private static final String KEY_CODES = "request_codes";
    private static final String KEY_NEXT_CODE = "next_request_code";
    private static final String KEY_ENABLED = "enabled";
    static final long LEAD_MS = 10 * 60 * 1000L;

    private PlanStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONArray items(Context ctx) {
        try {
            String raw = prefs(ctx).getString(KEY_ITEMS, "[]");
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Throwable t) {
            return new JSONArray();
        }
    }

    /** Store the plan list pushed by the web layer and (re)schedule reminders. */
    static void save(Context ctx, String json) {
        JSONArray previous = items(ctx);
        JSONArray incoming;
        try {
            incoming = new JSONArray(json == null ? "[]" : json);
            cancelAll(ctx, previous);
            prefs(ctx).edit().putString(KEY_ITEMS, json == null ? "[]" : json).apply();
        } catch (Throwable ignored) {
            return;
        }
        if (enabled(ctx)) scheduleAll(ctx);
    }

    static boolean enabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_ENABLED, true);
    }

    static void setEnabled(Context ctx, boolean enabled) {
        prefs(ctx).edit().putBoolean(KEY_ENABLED, enabled).apply();
        cancelAll(ctx, items(ctx));
        if (enabled) scheduleAll(ctx);
    }

    static JSONObject find(Context ctx, String id) {
        JSONArray arr = items(ctx);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && id != null && id.equals(o.optString("id"))) return o;
        }
        return null;
    }

    /** Next start time of a plan at or after `from`. */
    static long nextOccurrence(JSONObject plan, long from) {
        try {
            String time = plan.optString("time", "18:00");
            String[] parts = time.split(":");
            int hour = Integer.parseInt(parts[0].trim());
            int minute = parts.length > 1 ? Integer.parseInt(parts[1].trim()) : 0;
            String repeat = plan.optString("repeat", "daily");

            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(from);
            c.set(Calendar.HOUR_OF_DAY, hour);
            c.set(Calendar.MINUTE, minute);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);

            if ("weekly".equals(repeat)) {
                int target = plan.optInt("weekday", 1); // 0=Sun..6=Sat
                for (int i = 0; i < 8; i++) {
                    Calendar d = (Calendar) c.clone();
                    d.add(Calendar.DAY_OF_YEAR, i);
                    if (d.get(Calendar.DAY_OF_WEEK) - 1 == target
                            && d.getTimeInMillis() >= from) {
                        return d.getTimeInMillis();
                    }
                }
                return c.getTimeInMillis() + 7 * 24 * 3600_000L;
            }

            if ("monthly".equals(repeat)) {
                int day = Math.max(1, Math.min(31, plan.optInt("monthday", 1)));
                for (int i = 0; i < 4; i++) {
                    Calendar d = (Calendar) c.clone();
                    d.add(Calendar.MONTH, i);
                    int max = d.getActualMaximum(Calendar.DAY_OF_MONTH);
                    if (day > max) continue;
                    d.set(Calendar.DAY_OF_MONTH, day);
                    if (d.getTimeInMillis() >= from) return d.getTimeInMillis();
                }
                return c.getTimeInMillis() + 30 * 24 * 3600_000L;
            }

            // daily
            if (c.getTimeInMillis() >= from) return c.getTimeInMillis();
            return c.getTimeInMillis() + 24 * 3600_000L;
        } catch (Throwable t) {
            return from + 24 * 3600_000L;
        }
    }

    static void scheduleAll(Context ctx) {
        if (!enabled(ctx)) return;
        JSONArray arr = items(ctx);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            schedule(ctx, o, System.currentTimeMillis());
        }
    }

    /** Schedules the next "10 minutes before" reminder for one plan. */
    static void schedule(Context ctx, JSONObject plan, long from) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            String id = plan.optString("id");
            if (id == null || id.isEmpty()) return;

            long start = nextOccurrence(plan, from + 1000L);
            long fireAt = start - LEAD_MS;
            if (fireAt <= System.currentTimeMillis()) {
                // Too close to the next start: aim for the following occurrence.
                start = nextOccurrence(plan, start + 60_000L);
                fireAt = start - LEAD_MS;
            }

            Intent intent = new Intent(ctx, PlanReminderReceiver.class)
                    .setAction(PlanReminderReceiver.ACTION_REMIND)
                    .putExtra(PlanReminderReceiver.EXTRA_ID, id)
                    .putExtra(PlanReminderReceiver.EXTRA_START, start);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(
                    ctx, requestCode(ctx, id), intent, flags);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, fireAt, pi);
            }
        } catch (Throwable ignored) {}
    }

    static boolean canScheduleExact(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            return am != null && (Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                    || am.canScheduleExactAlarms());
        } catch (Throwable ignored) {
            return false;
        }
    }

    static int notificationId(Context ctx, String id) {
        return 100_000 + requestCode(ctx, id);
    }

    private static synchronized int requestCode(Context ctx, String id) {
        try {
            JSONObject codes = new JSONObject(prefs(ctx).getString(KEY_CODES, "{}"));
            if (codes.has(id)) return codes.getInt(id);
            int next = prefs(ctx).getInt(KEY_NEXT_CODE, 3000);
            codes.put(id, next);
            prefs(ctx).edit()
                    .putString(KEY_CODES, codes.toString())
                    .putInt(KEY_NEXT_CODE, next + 1)
                    .apply();
            return next;
        } catch (Throwable ignored) {
            return 3000 + (id.hashCode() & 0x3fffffff);
        }
    }

    private static PendingIntent pending(Context ctx, String id, int flags) {
        Intent intent = new Intent(ctx, PlanReminderReceiver.class)
                .setAction(PlanReminderReceiver.ACTION_REMIND)
                .putExtra(PlanReminderReceiver.EXTRA_ID, id);
        int immutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE : 0;
        return PendingIntent.getBroadcast(ctx, requestCode(ctx, id), intent, flags | immutable);
    }

    private static void cancelAll(Context ctx, JSONArray plans) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            for (int i = 0; i < plans.length(); i++) {
                JSONObject plan = plans.optJSONObject(i);
                if (plan == null) continue;
                String id = plan.optString("id");
                if (id.isEmpty()) continue;
                PendingIntent pi = pending(ctx, id, PendingIntent.FLAG_NO_CREATE);
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
                NotificationManagerCompat.cancel(ctx, notificationId(ctx, id));
            }
        } catch (Throwable ignored) {}
    }

    /** Tiny adapter keeps notification cancellation out of scheduling call sites. */
    private static final class NotificationManagerCompat {
        static void cancel(Context ctx, int id) {
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(id);
        }
    }
}
