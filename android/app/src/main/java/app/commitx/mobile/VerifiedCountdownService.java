package app.commitx.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import org.json.JSONObject;

/** Native, notification-only mirror of the existing Verified session clock. */
public class VerifiedCountdownService extends Service {
    private static final String PREFS = "commitx_verified_countdown";
    private static final String CHANNEL = "commitx_verified_countdown";
    private static final int ID = CommitXNotifications.ID_SESSION;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean registered;

    private final BroadcastReceiver screen = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            handler.removeCallbacks(tick);
            handler.post(tick);
        }
    };
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            JSONObject state = read(VerifiedCountdownService.this);
            if (state == null) { stopSelf(); return; }
            reconcile(VerifiedCountdownService.this, state);
            if (read(VerifiedCountdownService.this) == null) { stopSelf(); return; }
            PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
            // No wake lock or per-second alarm. Recalculate instantly on screen wake.
            handler.postDelayed(this, power != null && power.isInteractive() ? 1000 : 30000);
        }
    };

    static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences(PREFS, MODE_PRIVATE); }
    static JSONObject read(Context ctx) {
        try {
            String raw = prefs(ctx).getString("state", null);
            return raw == null ? null : new JSONObject(raw);
        } catch (Exception ignored) { return null; }
    }
    private static void save(Context ctx, JSONObject state) { prefs(ctx).edit().putString("state", state.toString()).apply(); }

    static void sync(Context ctx, String json) {
        try {
            JSONObject input = new JSONObject(json);
            if (input.optString("id").isEmpty() || input.optLong("durationMs") <= 0) return;
            long now = System.currentTimeMillis();
            long elapsed = SystemClock.elapsedRealtime();
            JSONObject previous = read(ctx);
            // Once the clock reached zero, wait for the existing session finalizer.
            if (previous != null && previous.optString("id").equals(input.optString("id"))
                    && "elapsed".equals(previous.optString("phase"))) return;
            input.put("endElapsed", input.isNull("endsAt") ? 0 : elapsed + Math.max(0, input.optLong("endsAt") - now));
            input.put("breakElapsed", input.isNull("breakAt") ? 0 : elapsed + Math.max(0, input.optLong("breakAt") - now));
            input.put("breakEndElapsed", input.isNull("breakEndsAt") ? 0 : elapsed + Math.max(0, input.optLong("breakEndsAt") - now));
            input.put("bootEpoch", now - elapsed);
            save(ctx, input);
            Intent service = new Intent(ctx, VerifiedCountdownService.class);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(service);
            else ctx.startService(service);
        } catch (Exception failure) {
            // Background service launch can be prohibited; the session is not altered.
            JSONObject state = read(ctx);
            if (state != null) reconcile(ctx, state);
        }
    }

    static void clear(Context ctx) {
        prefs(ctx).edit().remove("state").apply();
        cancelAlarm(ctx);
        ctx.stopService(new Intent(ctx, VerifiedCountdownService.class));
    }

    static void finish(Context ctx, String status) {
        JSONObject state = read(ctx);
        if (state == null) return;
        clear(ctx);
        NotificationManager manager = CommitXNotifications.manager(ctx);
        if (manager != null && canPost(ctx)) manager.notify(ID, notification(ctx, state,
                "completed".equals(status) ? "completed" : "failed"));
    }

    @Override public void onCreate() {
        super.onCreate();
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screen, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(screen, filter);
        registered = true;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        JSONObject state = read(this);
        if (state == null) { stopSelf(); return START_NOT_STICKY; }
        try {
            Notification n = notification(this, state, null);
            if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(ID, n);
        } catch (RuntimeException failure) { stopSelf(); return START_NOT_STICKY; }
        handler.removeCallbacks(tick);
        handler.post(tick);
        return START_STICKY;
    }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (registered) unregisterReceiver(screen);
        // Detach: completion/failure replaces the same notification ID.
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_DETACH);
        else stopForeground(false);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }

    static void reconcile(Context ctx, JSONObject state) {
        try {
            long elapsed = SystemClock.elapsedRealtime();
            // Never re-use a pre-reboot elapsedRealtime base as a live session.
            if (Math.abs(System.currentTimeMillis() - elapsed - state.optLong("bootEpoch")) > 60000) {
                clear(ctx);
                NotificationManager nm = CommitXNotifications.manager(ctx);
                if (nm != null) nm.cancel(ID);
                return;
            }
            String phase = state.optString("phase");
            long breakAt = state.optLong("breakElapsed");
            if ("focus".equals(phase) && breakAt > 0 && elapsed >= breakAt) {
                state.put("phase", "recovery_break");
                state.put("remainingMs", state.optLong("durationMs") / 2);
                state.put("breakEndElapsed", breakAt + 300000);
                state.put("endElapsed", 0);
                state.put("breakElapsed", 0);
                save(ctx, state);
                phase = "recovery_break";
            }
            if ("recovery_break".equals(phase) && elapsed >= state.optLong("breakEndElapsed")) {
                state.put("phase", "awaiting_confirmation");
                save(ctx, state);
            } else if ("focus".equals(phase) && state.optLong("endElapsed") > 0 && elapsed >= state.optLong("endElapsed")) {
                state.put("phase", "elapsed");
                save(ctx, state);
                cancelAlarm(ctx);
                ctx.stopService(new Intent(ctx, VerifiedCountdownService.class));
            }
            NotificationManager nm = CommitXNotifications.manager(ctx);
            if (nm != null && canPost(ctx)) nm.notify(ID, notification(ctx, state, null));
            schedule(ctx, state);
        } catch (Exception ignored) { /* Never interfere with session verification. */ }
    }

    private static Notification.Builder builder(Context ctx) {
        NotificationManager nm = CommitXNotifications.manager(ctx);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Verified focus countdown", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Remaining study time during a user-started Verified commitment.");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(channel);
        }
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
    }

    private static Notification notification(Context ctx, JSONObject state, String outcome) {
        String phase = state.optString("phase");
        long end = "recovery_break".equals(phase) ? state.optLong("breakEndElapsed") : state.optLong("endElapsed");
        boolean running = outcome == null && ("recovery_break".equals(phase) || "focus".equals(phase)) && end > 0;
        boolean terminal = outcome != null || "elapsed".equals(phase);
        long remaining = running ? VerifiedCountdownClock.remaining(end, SystemClock.elapsedRealtime()) : state.optLong("remainingMs");
        if (terminal) remaining = 0;
        String title = "Verified focus · " + VerifiedCountdownClock.format(remaining);
        String message = themeMessage(state.optString("theme"));
        if ("recovery_break".equals(phase)) { title = "Recovery break · " + VerifiedCountdownClock.format(remaining); message = "Your study timer is paused. Breathe, then come back."; }
        else if ("awaiting_confirmation".equals(phase)) { title = "Ready to focus again?"; message = "Your study timer is paused. Open CommitX and tap YES."; }
        else if (!running && !terminal) { message = "Your study timer is paused. Return to CommitX."; }
        if ("elapsed".equals(phase)) { title = "Verified focus · 00:00:00"; message = "Time reached. Return to CommitX to verify your result."; }
        if ("completed".equals(outcome)) { title = "Promise kept · 00:00:00"; message = "You showed up. You stayed. That counts."; }
        if ("failed".equals(outcome)) { title = "Verified session interrupted"; message = "Open CommitX to see your session result."; }
        Intent open = new Intent(ctx, MainActivity.class).putExtra(MainActivity.EXTRA_ROUTE, "session")
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(ctx, 11, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification publicVersion = builder(ctx).setSmallIcon(R.drawable.ic_verified_countdown)
                .setContentTitle("CommitX").setContentText(terminal ? "Session update" : "Focus session in progress")
                .setVisibility(Notification.VISIBILITY_PUBLIC).setContentIntent(tap).setShowWhen(false).build();
        Notification.Builder b = builder(ctx).setSmallIcon(R.drawable.ic_verified_countdown)
                .setContentTitle(title).setContentText(state.optString("goal", "Focus") + " · " + message)
                .setStyle(new Notification.BigTextStyle().bigText(state.optString("goal", "Focus") + "\n" + message))
                .setSubText("COMMITX · VERIFIED").setColor(ctx.getColor(themeColor(state.optString("theme"))))
                .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicVersion)
                .setOngoing(!terminal).setOnlyAlertOnce(true).setAutoCancel(terminal)
                .setCategory(Notification.CATEGORY_PROGRESS).setContentIntent(tap).setShowWhen(false);
        // System UI owns this live clock even when the app CPU is asleep.
        // Android formats its chronometer as M:SS/H:MM:SS; title is padded HH:MM:SS.
        if (running && Build.VERSION.SDK_INT >= 24) {
            b.setWhen(System.currentTimeMillis() + remaining).setShowWhen(true)
                    .setUsesChronometer(true).setChronometerCountDown(true);
        }
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }

    private static int themeColor(String theme) {
        switch (theme) {
            case "tree": return R.color.countdown_tree;
            case "moon": return R.color.countdown_moon;
            case "lotus": return R.color.countdown_lotus;
            case "fireflies": return R.color.countdown_fireflies;
            default: return R.color.countdown_leaves;
        }
    }
    private static boolean canPost(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager nm = CommitXNotifications.manager(ctx);
        return nm != null && (Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled());
    }
    private static String themeMessage(String theme) {
        switch (theme) {
            case "tree": return "Every focused minute helps your promise grow.";
            case "moon": return "Quiet mind. Clear promise. Stay with it.";
            case "lotus": return "Breathe. Settle. Keep the promise you made.";
            case "fireflies": return "Small sparks of focus become something bright.";
            default: return "Let distractions fall away. Your promise stays.";
        }
    }

    private static PendingIntent alarm(Context ctx) {
        return PendingIntent.getBroadcast(ctx, 1411, new Intent(ctx, VerifiedCountdownReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static void cancelAlarm(Context ctx) {
        AlarmManager manager = (AlarmManager) ctx.getSystemService(ALARM_SERVICE);
        if (manager != null) manager.cancel(alarm(ctx));
    }
    private static void schedule(Context ctx, JSONObject state) {
        long next = "recovery_break".equals(state.optString("phase")) ? state.optLong("breakEndElapsed")
                : "focus".equals(state.optString("phase")) ? state.optLong("breakElapsed", 0) : 0;
        if (next == 0 && "focus".equals(state.optString("phase"))) next = state.optLong("endElapsed");
        AlarmManager manager = (AlarmManager) ctx.getSystemService(ALARM_SERVICE);
        if (manager == null) return;
        manager.cancel(alarm(ctx));
        if (next <= 0) return;
        try {
            if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms())
                manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, next, alarm(ctx));
            else manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, next, alarm(ctx));
        } catch (SecurityException denied) {
            manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, next, alarm(ctx));
        }
    }
}