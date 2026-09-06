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

import java.util.Set;

/**
 * Foreground service that watches which app is in the foreground while Focus
 * Shield is on. When a blocked app opens, CommitX brings its own reminder screen
 * to the front. The blocked app stays installed, visible and untouched.
 */
public class FocusShieldService extends Service {
    private static final String CHANNEL = "commitx_focus_shield";
    private static final int NOTIF_ID = 4711;
    private static final long POLL_MS = 700L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private FocusShieldOverlay overlay;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (!FocusShieldStore.isActive(FocusShieldService.this)) {
                if (overlay != null) overlay.hide();
                stopSelf();
                return;
            }
            String fg = foregroundPackage();
            boolean blocked = fg != null
                    && FocusShieldStore.blockedPackages(FocusShieldService.this).contains(fg);
            if (overlay != null) {
                if (blocked) {
                    overlay.show(fg, FocusShieldStore.endsAt(FocusShieldService.this));
                } else if (fg != null && overlay.isShowing()) {
                    overlay.hide();
                }
            }
            handler.postDelayed(this, POLL_MS);
        }
    };


    static void start(Context ctx) {
        Intent intent = new Intent(ctx, FocusShieldService.class);
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
            ctx.stopService(new Intent(ctx, FocusShieldService.class));
        } catch (Throwable ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        startForegroundSafely();
        handler.post(tick);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startForegroundSafely() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL, getString(R.string.focus_shield_channel),
                        NotificationManager.IMPORTANCE_LOW);
                channel.setShowBadge(false);
                nm.createNotificationChannel(channel);
            }
            Intent open = new Intent(this, MainActivity.class);
            PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT
                            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                                    ? PendingIntent.FLAG_IMMUTABLE : 0));

            Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Notification.Builder(this, CHANNEL)
                    : new Notification.Builder(this);
            Notification notification = b
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(getString(R.string.focus_shield_on))
                    .setContentText(getString(R.string.focus_shield_running))
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

    /** Most recent foreground package from usage events (usage access required). */
    private String foregroundPackage() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return null;
            long end = System.currentTimeMillis();
            UsageEvents events = usm.queryEvents(end - 10_000L, end);
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

    /** Convenience for callers that just want the current blocked set. */
    static Set<String> blocked(Context ctx) {
        return FocusShieldStore.blockedPackages(ctx);
    }
}
