package app.commitx.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONObject;

import java.util.Iterator;

/**
 * Watches apps with a daily limit. At 50% of the limit it notifies once; at
 * 100% it covers the app with the CommitX reminder for the rest of the day.
 * Fully independent of Focus Shield: separate store, service and overlay.
 */
public class AppLimitsService extends Service {
    private static final String CHANNEL = "commitx_app_limits";
    private static final int NOTIF_ID = 4811;
    private static final long POLL_MS = 2000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private AppLimitsOverlay overlay;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (!AppLimitsStore.hasLimits(AppLimitsService.this)) {
                if (overlay != null) overlay.hide();
                stopSelf();
                return;
            }
            checkLimits();
            handler.postDelayed(this, POLL_MS);
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
        startForegroundSafely();
        handler.post(tick);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        handler.removeCallbacks(tick);
        handler.post(tick);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (overlay != null) overlay.hide();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void checkLimits() {
        String blockedNow = null;
        try {
            JSONObject all = new JSONObject(
                    getSharedPreferences("commitx_app_limits", Context.MODE_PRIVATE)
                            .getString("limits", "{}"));
            String fg = foregroundPackage();
            Iterator<String> keys = all.keys();
            while (keys.hasNext()) {
                String pkg = keys.next();
                JSONObject entry = all.optJSONObject(pkg);
                if (entry == null) continue;
                int limit = entry.optInt("minutes", 0);
                if (limit <= 0) continue;
                int used = AppLimitsStore.usageMinutes(this, pkg);
                if (used < 0) continue; // no usage access right now
                String label = AppLimitsStore.labelFor(this, pkg);
                if (used >= limit) {
                    if (AppLimitsStore.markNotified(this, pkg, 100)) {
                        CommitXNotifications.showAppLimitReached(this, label);
                    }
                    if (pkg.equals(fg)) blockedNow = pkg;
                } else if (used * 2 >= limit) {
                    if (AppLimitsStore.markNotified(this, pkg, 50)) {
                        CommitXNotifications.showAppLimitHalf(this, label);
                    }
                }
            }
            if (overlay != null) {
                if (blockedNow != null) {
                    overlay.show(blockedNow, AppLimitsStore.endOfToday());
                } else if (fg != null && overlay.isShowing()) {
                    // No resumed event in the last 60s means the foreground app is
                    // unchanged (fg == null); only hide when another app is on top.
                    overlay.hide();
                }
            }
        } catch (Throwable ignored) {}
    }

    private void startForegroundSafely() {
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
        } catch (Throwable ignored) {}
    }

    private String foregroundPackage() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return null;
            long end = System.currentTimeMillis();
            UsageEvents events = usm.queryEvents(end - 60_000L, end);
            UsageEvents.Event event = new UsageEvents.Event();
            String last = null;
            while (events != null && events.hasNextEvent()) {
                events.getNextEvent(event);
                int type = event.getEventType();
                boolean resumed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? type == UsageEvents.Event.ACTIVITY_RESUMED
                        : type == UsageEvents.Event.MOVE_TO_FOREGROUND;
                if (resumed) last = event.getPackageName();
            }
            return last;
        } catch (Throwable t) {
            return null;
        }
    }
}
