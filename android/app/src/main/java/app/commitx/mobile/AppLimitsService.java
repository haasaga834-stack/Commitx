package app.commitx.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;

import org.json.JSONObject;

import java.util.Iterator;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Watches apps with a daily limit. At 50% of the limit it notifies once; at
 * 100% it covers the app with the CommitX reminder for the rest of the day.
 * Fully independent of Focus Shield: separate store, service and overlay.
 */
public class AppLimitsService extends Service {
    private static final String CHANNEL = "commitx_app_limits";
    private static final int NOTIF_ID = 4811;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private HandlerThread workerThread;
    private Handler worker;
    private AppLimitsOverlay overlay;
    private final Set<String> exhausted = new HashSet<>();
    private String limitsJson;
    private String usageDay;
    private String lastForeground;
    private long lastEventQuery;
    private long lastUsageRefresh;
    private volatile boolean destroyed;
    private boolean foregroundReady;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (!AppLimitsStore.hasLimits(AppLimitsService.this)) {
                handler.post(() -> {
                    if (overlay != null) overlay.hide();
                    stopSelf();
                });
                return;
            }
            checkLimits();
            if (worker != null && !destroyed) worker.postDelayed(this, AppLimitsPolicy.POLL_MS);
        }
    };

    static void startIfNeeded(Context ctx) {
        if (!AppLimitsStore.hasLimits(ctx)) return;
        if (!FocusShieldStore.hasUsageAccess(ctx) || !FocusShieldStore.hasOverlayAccess(ctx)) return;
        Intent intent = new Intent(ctx, AppLimitsService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
        } catch (Throwable ignored) {}
    }

    static void stop(Context ctx) {
        try {
            ctx.stopService(new Intent(ctx, AppLimitsService.class));
        } catch (Throwable ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        overlay = new AppLimitsOverlay(this);
        foregroundReady = startForegroundSafely();
        if (!foregroundReady) { stopSelf(); return; }
        workerThread = new HandlerThread("commitx-app-limits");
        workerThread.start();
        worker = new Handler(workerThread.getLooper());
        worker.post(tick);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!foregroundReady) { stopSelf(); return START_NOT_STICKY; }
        if (worker != null) {
            worker.removeCallbacks(tick);
            worker.post(tick);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        destroyed = true;
        if (worker != null) worker.removeCallbacksAndMessages(null);
        if (workerThread != null) workerThread.quitSafely();
        handler.removeCallbacksAndMessages(null);
        if (overlay != null) overlay.hide();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void checkLimits() {
        try {
            String raw = getSharedPreferences("commitx_app_limits", Context.MODE_PRIVATE)
                    .getString("limits", "{}");
            String day = AppLimitsStore.dayKey();
            boolean changed = !day.equals(usageDay) || !raw.equals(limitsJson);
            if (changed) {
                exhausted.clear();
                usageDay = day;
                limitsJson = raw;
            }
            String fg = foregroundPackage();
            // Reopening an already exhausted app must not wait for usage queries,
            // package-label lookups, or notification work.
            applyCover(fg);
            long now = SystemClock.elapsedRealtime();
            if (!AppLimitsPolicy.needsRefresh(now, lastUsageRefresh, changed)) return;
            Map<String, UsageStats> stats = AppLimitsStore.usageSnapshot(this);
            if (stats == null) return; // retain protection through transient query failures
            lastUsageRefresh = now;
            JSONObject all = new JSONObject(raw);
            Set<String> refreshed = new HashSet<>();
            Iterator<String> keys = all.keys();
            while (keys.hasNext()) {
                String pkg = keys.next();
                JSONObject entry = all.optJSONObject(pkg);
                if (entry == null) continue;
                int limit = entry.optInt("minutes", 0);
                if (limit <= 0) continue;
                int threshold = AppLimitsPolicy.threshold(AppLimitsStore.usageMillis(stats, pkg), limit);
                if (threshold == 100) {
                    refreshed.add(pkg);
                    if (AppLimitsStore.markNotified(this, pkg, 100)) {
                        CommitXNotifications.showAppLimitReached(this, AppLimitsStore.labelFor(this, pkg));
                    }
                } else if (threshold == 50) {
                    if (AppLimitsStore.markNotified(this, pkg, 50)) {
                        CommitXNotifications.showAppLimitHalf(this, AppLimitsStore.labelFor(this, pkg));
                    }
                }
            }
            exhausted.clear();
            exhausted.addAll(refreshed);
            // Query again after aggregation in case the user switched meanwhile.
            applyCover(foregroundPackage());
        } catch (Throwable ignored) {}
    }

    private void applyCover(String fg) {
        String blockedNow = fg != null && exhausted.contains(fg) ? fg : null;
        long endsAt = AppLimitsStore.endOfToday();
        handler.post(() -> {
            if (destroyed || overlay == null) return;
            if (blockedNow != null) overlay.show(blockedNow, endsAt);
            else if (AppLimitsPolicy.shouldHide(fg, blockedNow)) overlay.hide();
        });
    }

    private boolean startForegroundSafely() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL, "App limits", NotificationManager.IMPORTANCE_LOW);
                channel.setShowBadge(false);
                nm.createNotificationChannel(channel);
            }
            Intent open = new Intent(this, MainActivity.class)
                    .putExtra(MainActivity.EXTRA_ROUTE, "/screen-time");
            PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT
                            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                                    ? PendingIntent.FLAG_IMMUTABLE : 0));
            Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Notification.Builder(this, CHANNEL)
                    : new Notification.Builder(this);
            Notification notification = b
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("App limits on")
                    .setContentText("CommitX is watching your daily app limits")
                    .setOngoing(true)
                    .setContentIntent(pi)
                    .build();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIF_ID, notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIF_ID, notification);
            }
            return true;
        } catch (RuntimeException denied) { return false; }
    }

    private String foregroundPackage() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return null;
            long end = System.currentTimeMillis();
            long start = lastEventQuery == 0L || end < lastEventQuery
                    ? end - 60_000L : Math.max(end - 60_000L, lastEventQuery - 1000L);
            UsageEvents events = usm.queryEvents(start, end);
            if (events == null) return lastForeground;
            lastEventQuery = end;
            UsageEvents.Event event = new UsageEvents.Event();
            while (events != null && events.hasNextEvent()) {
                events.getNextEvent(event);
                int type = event.getEventType();
                boolean resumed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? type == UsageEvents.Event.ACTIVITY_RESUMED
                        : type == UsageEvents.Event.MOVE_TO_FOREGROUND;
                if (resumed) lastForeground = event.getPackageName();
            }
            return lastForeground;
        } catch (Throwable t) {
            return null;
        }
    }
}
