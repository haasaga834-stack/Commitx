package app.commitx.mobile;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Detailed on-device screen-time breakdown read from UsageStatsManager:
 * per-app minutes today, hourly buckets for today and daily totals for the
 * last 7 days. Nothing here leaves the device; the WebView reads it via the bridge.
 */
final class ScreenTimeDetails {
    private ScreenTimeDetails() {}

    private static final Map<String, String> ICON_CACHE = new HashMap<>();

    /** Walks foreground events and attributes wall-clock slices to one package at a time. */
    static Map<String, Long> usage(Context ctx, long start, long end, long[] hourly, long hourBase) {
        Map<String, Long> out = new HashMap<>();
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null || end <= start) return out;
        UsageEvents events = usm.queryEvents(start, end);
        if (events == null) return out;
        UsageEvents.Event e = new UsageEvents.Event();
        String cur = null;
        long from = 0L;
        boolean off = false;
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            int type = e.getEventType();
            long ts = Math.min(end, Math.max(start, e.getTimeStamp()));
            String pkg = e.getPackageName();
            if (type == 17 || type == 15) {
                if (cur != null) add(out, hourly, hourBase, cur, from, ts);
                cur = null;
                off = true;
                continue;
            }
            if (type == 16 || type == 18) { off = false; continue; }
            if (pkg == null) continue;
            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                off = false;
                if (cur != null) add(out, hourly, hourBase, cur, from, ts);
                cur = pkg;
                from = ts;
            } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                if (cur != null && cur.equals(pkg)) {
                    add(out, hourly, hourBase, cur, from, ts);
                    cur = null;
                }
            }
        }
        if (cur != null && !off) add(out, hourly, hourBase, cur, from, end);
        return out;
    }

    private static void add(Map<String, Long> out, long[] hourly, long hourBase,
                            String pkg, long from, long to) {
        long ms = Math.max(0L, to - from);
        if (ms == 0) return;
        Long prev = out.get(pkg);
        out.put(pkg, (prev == null ? 0L : prev) + ms);
        if (hourly == null) return;
        long t = from;
        while (t < to) {
            int h = (int) ((t - hourBase) / 3600000L);
            if (h < 0 || h >= hourly.length) break;
            long bucketEnd = hourBase + (h + 1) * 3600000L;
            long slice = Math.min(to, bucketEnd) - t;
            hourly[h] += slice;
            t += slice;
        }
    }

    private static long dayStart(int daysAgo) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, -daysAgo);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static long sum(Map<String, Long> m) {
        long t = 0;
        for (Long v : m.values()) t += v;
        return t;
    }

    static String iconFor(Context ctx, PackageManager pm, String pkg) {
        if (ICON_CACHE.containsKey(pkg)) return ICON_CACHE.get(pkg);
        String data = null;
        try {
            Drawable d = pm.getApplicationIcon(pkg);
            int size = 72;
            Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, size, size);
            d.draw(c);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, bos);
            data = "data:image/png;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
        } catch (Throwable ignored) {}
        ICON_CACHE.put(pkg, data);
        return data;
    }

    static String toJson(Context ctx) {
        JSONObject o = new JSONObject();
        try {
            o.put("supported", ScreenTimeTracker.supported());
            boolean granted = ScreenTimeTracker.hasPermission(ctx);
            o.put("granted", granted);
            if (!granted) return o.toString();

            String self = ctx.getPackageName();
            long now = System.currentTimeMillis();
            long today = dayStart(0);
            long[] hourly = new long[24];
            Map<String, Long> todayMap = usage(ctx, today, now, hourly, today);
            long total = Math.min(sum(todayMap), now - today);
            Long own = todayMap.get(self);
            long ownMs = own == null ? 0 : own;
            o.put("totalMinutes", total / 60000L);
            o.put("commitxMinutes", ownMs / 60000L);
            o.put("otherMinutes", Math.max(0, total - ownMs) / 60000L);

            JSONArray hours = new JSONArray();
            for (long h : hourly) hours.put(Math.min(60, h / 60000L));
            o.put("hourly", hours);

            PackageManager pm = ctx.getPackageManager();
            List<Map.Entry<String, Long>> list = new ArrayList<>(todayMap.entrySet());
            Collections.sort(list, (a, b) -> Long.compare(b.getValue(), a.getValue()));
            JSONArray apps = new JSONArray();
            for (Map.Entry<String, Long> en : list) {
                long mins = en.getValue() / 60000L;
                if (mins < 1) continue;
                if (apps.length() >= 40) break;
                String pkg = en.getKey();
                String label = pkg;
                try {
                    ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                    label = String.valueOf(pm.getApplicationLabel(ai));
                } catch (Throwable ignored) {}
                JSONObject a = new JSONObject();
                a.put("packageName", pkg);
                a.put("label", label);
                a.put("minutes", mins);
                a.put("isCommitX", self.equals(pkg));
                String icon = iconFor(ctx, pm, pkg);
                if (icon != null) a.put("icon", icon);
                apps.put(a);
            }
            o.put("apps", apps);

            JSONArray week = new JSONArray();
            for (int i = 6; i >= 0; i--) {
                long s = dayStart(i);
                long e = i == 0 ? now : dayStart(i - 1);
                long mins = i == 0 ? total / 60000L
                        : Math.min(sum(usage(ctx, s, e, null, 0)), e - s) / 60000L;
                JSONObject d = new JSONObject();
                d.put("dayStart", s);
                d.put("minutes", mins);
                week.put(d);
            }
            o.put("week", week);
        } catch (Throwable ignored) {}
        return o.toString();
    }
}
