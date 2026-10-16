package app.commitx.mobile;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Iterator;
import java.util.Map;

/**
 * Daily per-app usage limits ("App Usage Limits"). Independent of Focus Shield:
 * limits live in their own store, usage is read from UsageStatsManager starting
 * at local midnight, so every day naturally starts at zero. Reels/Shorts limits
 * are converted to minutes by the web layer (~30s per reel) before saving.
 */
final class AppLimitsStore {
    private static final String PREFS = "commitx_app_limits";
    private static final String KEY_LIMITS = "limits";       // JSON: pkg -> {type, minutes}
    private static final String KEY_NOTIFIED = "notified";   // JSON: "<day>|<pkg>|<pct>" -> true

    private AppLimitsStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String dayKey() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.YEAR) + "-" + c.get(Calendar.MONTH) + "-" + c.get(Calendar.DAY_OF_MONTH);
    }

    static long startOfToday() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    static long endOfToday() {
        return startOfToday() + 24L * 60L * 60L * 1000L;
    }

    private static JSONObject limits(Context ctx) {
        try {
            return new JSONObject(prefs(ctx).getString(KEY_LIMITS, "{}"));
        } catch (Throwable t) {
            return new JSONObject();
        }
    }

    /** type: "time" or "reels" (reels already converted to minutes by caller). */
    static void setLimit(Context ctx, String pkg, String type, int minutes) {
        if (pkg == null || minutes <= 0) return;
        try {
            JSONObject all = limits(ctx);
            JSONObject entry = new JSONObject();
            entry.put("type", "reels".equals(type) ? "reels" : "time");
            entry.put("minutes", minutes);
            all.put(pkg, entry);
            prefs(ctx).edit().putString(KEY_LIMITS, all.toString()).apply();
        } catch (Throwable ignored) {}
    }

    static void removeLimit(Context ctx, String pkg) {
        try {
            JSONObject all = limits(ctx);
            all.remove(pkg);
            prefs(ctx).edit().putString(KEY_LIMITS, all.toString()).apply();
        } catch (Throwable ignored) {}
    }

    static boolean hasLimits(Context ctx) {
        return limits(ctx).length() > 0;
    }

    /** Minutes the package was in the foreground today, or -1 without usage access. */
    static int usageMinutes(Context ctx, String pkg) {
        try {
            UsageStatsManager usm =
                    (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return -1;
            Map<String, UsageStats> stats =
                    usm.queryAndAggregateUsageStats(startOfToday(), System.currentTimeMillis());
            if (stats == null) return -1;
            UsageStats s = stats.get(pkg);
            if (s == null) return 0;
            return (int) (Math.max(0L, s.getTotalTimeInForeground()) / 60000L);
        } catch (Throwable t) {
            return -1;
        }
    }

    static String labelFor(Context ctx, String pkg) {
        try {
            PackageManager pm = ctx.getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (Throwable t) {
            return pkg;
        }
    }

    /** Limits with live usage, for the web layer: [{pkg,label,type,minutes,usedMinutes}]. */
    static String toJson(Context ctx) {
        JSONObject all = limits(ctx);
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        Iterator<String> keys = all.keys();
        while (keys.hasNext()) {
            String pkg = keys.next();
            JSONObject entry = all.optJSONObject(pkg);
            if (entry == null) continue;
            int minutes = entry.optInt("minutes", 0);
            if (minutes <= 0) continue;
            int used = usageMinutes(ctx, pkg);
            if (!first) sb.append(',');
            first = false;
            sb.append("{\"pkg\":\"").append(pkg).append("\",")
              .append("\"label\":\"").append(labelFor(ctx, pkg).replace("\"", "'")).append("\",")
              .append("\"type\":\"").append(entry.optString("type", "time")).append("\",")
              .append("\"minutes\":").append(minutes).append(",")
              .append("\"usedMinutes\":").append(Math.max(0, used)).append('}');
        }
        return sb.append(']').toString();
    }

    /** True once per day per app per threshold; used to avoid notification spam. */
    static boolean markNotified(Context ctx, String pkg, int percent) {
        String key = dayKey() + "|" + pkg + "|" + percent;
        try {
            JSONObject flags = new JSONObject(prefs(ctx).getString(KEY_NOTIFIED, "{}"));
            if (flags.optBoolean(key, false)) return false;
            flags.put(key, true);
            // Drop flags from earlier days so the store stays tiny.
            JSONObject kept = new JSONObject();
            String today = dayKey() + "|";
            Iterator<String> it = flags.keys();
            while (it.hasNext()) {
                String k = it.next();
                if (k.startsWith(today)) kept.put(k, flags.optBoolean(k));
            }
            prefs(ctx).edit().putString(KEY_NOTIFIED, kept.toString()).apply();
            return true;
        } catch (Throwable t) {
            return false;
        }
    }
}
