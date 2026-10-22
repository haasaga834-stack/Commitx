package app.commitx.mobile;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.TreeMap;

/**
 * Focus Shield state + capability checks.
 *
 * Legitimate, Android-supported approach: usage access (UsageStatsManager) tells
 * us which app just came to the foreground, and "display over other apps"
 * (SYSTEM_ALERT_WINDOW) lets CommitX show its own reminder screen on top instead
 * of the blocked app. No AccessibilityService, no package hiding, no uninstalling.
 */
final class FocusShieldStore {
    private static final String PREFS = "commitx_focus_shield";
    private static final String KEY_ACTIVE = "active";
    private static final String KEY_PACKAGES = "packages";
    private static final String KEY_ENDS_AT = "ends_at";
    private static final String KEY_STARTED_AT = "started_at";

    /** Packages Focus Shield can protect against; mirrored in src/lib/focus-shield.ts. */
    static final List<String> SUPPORTED = Arrays.asList(
            "com.instagram.android",
            "com.google.android.youtube",
            "com.facebook.katana",
            "com.whatsapp",
            "com.facebook.orca",
            "com.reddit.frontpage",
            "com.twitter.android",
            "com.snapchat.android",
            "com.android.chrome",
            "com.dts.freefireth",
            "com.dts.freefiremax",
            "com.pubg.imobile",
            "com.tencent.ig",
            "com.activision.callofduty.shooter",
            "com.supercell.clashofclans",
            "com.supercell.clashroyale",
            "com.supercell.brawlstars",
            "com.mojang.minecraftpe",
            "com.roblox.client",
            "com.king.candycrushsaga",
            "com.ea.gp.fifamobile");

    private static final Set<String> SOCIAL = new HashSet<>(Arrays.asList(
            "com.instagram.android", "com.instagram.lite", "com.google.android.youtube",
            "com.facebook.katana", "com.facebook.lite", "com.whatsapp", "com.whatsapp.w4b",
            "com.facebook.orca", "com.reddit.frontpage", "com.twitter.android",
            "com.snapchat.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
            "com.discord",
            "com.pinterest", "com.linkedin.android", "com.bsky.app", "com.instagram.barcelona"));

    @SuppressWarnings("deprecation")
    private static boolean defaultBlocked(ApplicationInfo info, Set<String> browsers) {
        // Telegram remains selectable, but never a required default (even if SOCIAL).
        if (info.packageName.equals("org.telegram.messenger")
                || info.packageName.equals("org.telegram.messenger.web")
                || info.packageName.equals("org.thunderdog.challegram")) return false;
        if (browsers.contains(info.packageName) || info.packageName.equals("com.android.chrome")
                || info.packageName.equals("com.microsoft.emmx")) return true;
        if (SOCIAL.contains(info.packageName)) return true;
        if (SUPPORTED.contains(info.packageName) && !info.packageName.equals("com.android.chrome")) return true;
        if ((info.flags & ApplicationInfo.FLAG_IS_GAME) != 0) return true;
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && (info.category == ApplicationInfo.CATEGORY_GAME
                || info.category == ApplicationInfo.CATEGORY_SOCIAL);
    }

    private FocusShieldStore() {}

    private static volatile String cachedApps;
    private static volatile long cachedAt;
    private static boolean loadingApps;
    private static final java.util.concurrent.ExecutorService appLoader = java.util.concurrent.Executors.newSingleThreadExecutor();

    /** Package scans and icon encoding never block a WebView bridge call. */
    static synchronized void preloadApps(Context ctx, boolean refresh) {
        if (loadingApps || (!refresh && cachedApps != null && System.currentTimeMillis() - cachedAt < 300000)) return;
        loadingApps = true;
        Context app = ctx.getApplicationContext();
        appLoader.execute(() -> {
            try { cachedApps = buildInstalledAppsJson(app); cachedAt = System.currentTimeMillis(); }
            finally { synchronized (FocusShieldStore.class) { loadingApps = false; } }
            MainActivity.notifyShieldAppsReady();
        });
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Generic web URL handlers cover installed browsers, not just a fixed brand list. */
    private static Set<String> browserPackages(Context ctx) {
        Set<String> result = new HashSet<>();
        for (String scheme : Arrays.asList("https", "http")) {
            Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse(scheme + "://example.com/"))
                    .addCategory(Intent.CATEGORY_BROWSABLE);
            try {
                for (ResolveInfo match : ctx.getPackageManager().queryIntentActivities(web, PackageManager.MATCH_ALL)) {
                    if (match.activityInfo != null) result.add(match.activityInfo.packageName);
                }
            } catch (RuntimeException ignored) {}
        }
        result.remove(ctx.getPackageName());
        return result;
    }

    /** Foreground-app detection needs Android 5.0+ usage stats. */
    static boolean supported() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP;
    }

    static boolean hasUsageAccess(Context ctx) {
        if (!supported()) return false;
        try {
            AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (ops == null) return false;
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = ops.unsafeCheckOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(),
                        ctx.getPackageName());
            } else {
                mode = ops.checkOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(),
                        ctx.getPackageName());
            }
            if (mode == AppOpsManager.MODE_ALLOWED) return true;
            if (mode == AppOpsManager.MODE_IGNORED || mode == AppOpsManager.MODE_ERRORED) return false;
            // Several OEMs report MODE_DEFAULT even after the user grants Usage
            // Access, which made the permission dialog reappear forever. Probe
            // real usage data to confirm the grant in that case.
            return usageProbeWorks(ctx);
        } catch (Throwable t) {
            return false;
        }
    }

    /** True when a real usage query returns data, i.e. access is effectively granted. */
    private static boolean usageProbeWorks(Context ctx) {
        try {
            UsageStatsManager usm =
                    (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return false;
            long now = System.currentTimeMillis();
            java.util.List<UsageStats> stats = usm.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY, now - 24L * 60L * 60L * 1000L, now);
            return stats != null && !stats.isEmpty();
        } catch (Throwable t) {
            return false;
        }
    }

    static boolean hasOverlayAccess(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        try {
            return Settings.canDrawOverlays(ctx);
        } catch (Throwable t) {
            return false;
        }
    }

    /** User-launchable apps; system components and CommitX itself cannot be blocked. */
    private static Map<String, ApplicationInfo> selectableApps(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        Map<String, ApplicationInfo> result = new TreeMap<>();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        try {
            ResolveInfo homeApp = pm.resolveActivity(
                    new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
                    PackageManager.MATCH_DEFAULT_ONLY);
            String homePackage = homeApp != null && homeApp.activityInfo != null
                    ? homeApp.activityInfo.packageName : null;
            List<ResolveInfo> matches = pm.queryIntentActivities(launcher, 0);
            for (ResolveInfo match : matches) {
                if (match.activityInfo == null || match.activityInfo.applicationInfo == null) continue;
                ApplicationInfo info = match.activityInfo.applicationInfo;
                String pkg = info.packageName;
                if (pkg == null || pkg.equals(ctx.getPackageName())
                        || pkg.equals("com.android.settings")
                        || pkg.equals("com.google.android.dialer")
                        || pkg.equals("com.android.dialer")
                        || pkg.equals("com.android.contacts")
                        || pkg.equals("com.google.android.contacts")
                        || pkg.equals("com.android.systemui")) continue;
                // Never block a home/launcher app: users must be able to leave
                // the blocked app and get back to CommitX.
                if (pkg.equals(homePackage)) continue;
                result.put(pkg, info);
            }
        } catch (Throwable ignored) {}
        // Keep the existing named apps available on devices whose launcher
        // query is limited by the manufacturer.
        Set<String> known = new LinkedHashSet<>(SUPPORTED);
        known.addAll(SOCIAL);
        known.addAll(browserPackages(ctx));
        // Keep Telegram selectable even when launcher discovery is manufacturer-limited.
        known.addAll(Arrays.asList("org.telegram.messenger", "org.telegram.messenger.web", "org.thunderdog.challegram"));
        for (String pkg : known) {
            if (result.containsKey(pkg)) continue;
            try { result.put(pkg, pm.getApplicationInfo(pkg, 0)); }
            catch (Throwable ignored) {}
        }
        return result;
    }

    /** Installed selectable apps as a JSON array of {pkg,label,icon}. */
    static String installedAppsJson(Context ctx) {
        preloadApps(ctx, false);
        return cachedApps == null ? "[]" : cachedApps;
    }

    private static String buildInstalledAppsJson(Context ctx) {
        StringBuilder sb = new StringBuilder("[");
        PackageManager pm = ctx.getPackageManager();
        boolean first = true;
        Set<String> browsers = browserPackages(ctx);
        List<Map.Entry<String, ApplicationInfo>> entries = new ArrayList<>(selectableApps(ctx).entrySet());
        Collections.sort(entries, Comparator.comparing(e -> String.valueOf(pm.getApplicationLabel(e.getValue())).toLowerCase()));
        for (Map.Entry<String, ApplicationInfo> entry : entries) {
            String pkg = entry.getKey();
            ApplicationInfo info = entry.getValue();
            String label;
            try {
                label = String.valueOf(pm.getApplicationLabel(info));
            } catch (Throwable t) {
                label = pkg;
            }
            String icon = iconDataUrl(pm, info);
            if (!first) sb.append(',');
            first = false;
            sb.append("{\"pkg\":\"").append(escape(pkg)).append("\",")
              .append("\"label\":\"").append(escape(label)).append("\"")
              .append(",\"defaultBlocked\":").append(defaultBlocked(info, browsers));
            if (icon != null) sb.append(",\"icon\":\"").append(icon).append("\"");
            sb.append('}');
        }
        return sb.append(']').toString();
    }

    private static String iconDataUrl(PackageManager pm, ApplicationInfo info) {
        try {
            Drawable d = pm.getApplicationIcon(info);
            int size = 48;
            Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bmp);
            d.setBounds(0, 0, size, size);
            d.draw(canvas);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
            bmp.recycle();
            return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Throwable t) {
            return null;
        }
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
    }

    /** Persists only apps that are selectable on this device. */
    static void start(Context ctx, Set<String> packages, long endsAtMs) {
        Set<String> clean = new LinkedHashSet<>();
        Set<String> allowed = selectableApps(ctx).keySet();
        for (String p : packages) {
            if (allowed.contains(p)) clean.add(p);
        }
        prefs(ctx).edit()
                .putBoolean(KEY_ACTIVE, !clean.isEmpty())
                .putStringSet(KEY_PACKAGES, clean)
                .putLong(KEY_ENDS_AT, endsAtMs)
                .putLong(KEY_STARTED_AT, System.currentTimeMillis())
                .apply();
    }

    static void stop(Context ctx) {
        prefs(ctx).edit()
                .putBoolean(KEY_ACTIVE, false)
                .putStringSet(KEY_PACKAGES, new HashSet<>())
                .putLong(KEY_ENDS_AT, 0L)
                .apply();
    }

    /** Active only while the window has not expired and permissions still hold. */
    static boolean isActive(Context ctx) {
        SharedPreferences p = prefs(ctx);
        if (!p.getBoolean(KEY_ACTIVE, false)) return false;
        long endsAt = p.getLong(KEY_ENDS_AT, 0L);
        if (endsAt > 0 && System.currentTimeMillis() > endsAt) return false;
        if (blockedPackages(ctx).isEmpty()) return false;
        return hasUsageAccess(ctx) && hasOverlayAccess(ctx);
    }

    static Set<String> blockedPackages(Context ctx) {
        Set<String> set = prefs(ctx).getStringSet(KEY_PACKAGES, null);
        return set == null ? new HashSet<>() : set;
    }

    static long endsAt(Context ctx) {
        return prefs(ctx).getLong(KEY_ENDS_AT, 0L);
    }
}
