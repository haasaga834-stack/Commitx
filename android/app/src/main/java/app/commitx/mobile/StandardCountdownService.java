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

/** Native, notification-only mirror of the existing Standard session clock. */
public class StandardCountdownService extends Service {
    private static final String PREFS = "commitx_standard_countdown";
    private static final String CHANNEL = "commitx_standard_countdown";
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
            JSONObject state = read(StandardCountdownService.this);
            if (state == null) { stopSelf(); return; }
            reconcile(StandardCountdownService.this, state);
            if (read(StandardCountdownService.this) == null) { stopSelf(); return; }
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
            Intent service = new Intent(ctx, StandardCountdownService.class);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(service);
            else ctx.startService(service);
        } catch (Exception failure) {
            // Background service launch can be prohibited; the session is not altered.
            JSONObject state = read(ctx);
            if (state != null) reconcile(ctx, state);
        }
    }

    /** Re-derives elapsedRealtime deadlines from wall-clock fields after a reboot. */
    static boolean rebase(Context ctx, JSONObject state) {
        try {
            long now = System.currentTimeMillis();
            long elapsed = SystemClock.elapsedRealtime();
            String phase = state.optString("phase");
            if (!"focus".equals(phase) && !"recovery_break".equals(phase)) return false;
            long endsAt = state.isNull("endsAt") ? 0 : state.optLong("endsAt");
            long breakAt = state.isNull("breakAt") ? 0 : state.optLong("breakAt");
            long breakEndsAt = state.isNull("breakEndsAt") ? 0 : state.optLong("breakEndsAt");
            if (endsAt <= 0 && breakEndsAt <= 0) return false;
            state.put("endElapsed", endsAt > 0 ? elapsed + Math.max(0, endsAt - now) : 0);
            state.put("breakElapsed", breakAt > now ? elapsed + (breakAt - now) : 0);
            state.put("breakEndElapsed", breakEndsAt > 0 ? elapsed + Math.max(0, breakEndsAt - now) : 0);
            state.put("bootEpoch", now - elapsed);
            save(ctx, state);
            return true;
        } catch (Exception ignored) { return false; }
    }

    /** Called on BOOT_COMPLETED: restore the live countdown when a session was running. */
    static void restoreAfterBoot(Context ctx) {
        JSONObject state = read(ctx);
        if (state == null || !rebase(ctx, state)) return;
        try {
            Intent service = new Intent(ctx, StandardCountdownService.class);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(service);
            else ctx.startService(service);
        } catch (Exception ignored) { reconcile(ctx, state); }
    }

    static void clear(Context ctx) {
        prefs(ctx).edit().remove("state").apply();
        cancelAlarm(ctx);
        ctx.stopService(new Intent(ctx, StandardCountdownService.class));
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
                // Rebooted: rebuild the monotonic deadlines from the saved
                // wall-clock timestamps instead of dropping the session.
                if (!rebase(ctx, state)) {
                    clear(ctx);
                    NotificationManager nm = CommitXNotifications.manager(ctx);
                    if (nm != null) nm.cancel(ID);
                    return;
                }
                elapsed = SystemClock.elapsedRealtime();
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
                ctx.stopService(new Intent(ctx, StandardCountdownService.class));
            }
            NotificationManager nm = CommitXNotifications.manager(ctx);
            if (nm != null && canPost(ctx)) nm.notify(ID, notification(ctx, state, null));
            schedule(ctx, state);
        } catch (Exception ignored) { /* Never interfere with session verification. */ }
    }

    private static Notification notification(Context ctx, JSONObject state, String outcome) {
        String phase = state.optString("phase");
        long end = "recovery_break".equals(phase) ? state.optLong("breakEndElapsed") : state.optLong("endElapsed");
        boolean running = ("focus".equals(phase) || "recovery_break".equals(phase)) && end > 0;
        long remaining = running ? VerifiedCountdownClock.remaining(end, SystemClock.elapsedRealtime()) : state.optLong("remainingMs");
        if ("elapsed".equals(phase)) remaining = 0;
        long total = Math.max(1, state.optLong("durationMs"));
        int pct = (int) Math.max(0, Math.min(100, Math.round(100.0 * (total - Math.min(total, remaining)) / total)));
        String time = String.format(java.util.Locale.US, "%02d:%02d", (long) Math.ceil(remaining / 1000.0) / 60, (long) Math.ceil(remaining / 1000.0) % 60);
        String title = "Standard session · " + time + " left";
        String text = state.optString("goal", "Focus") + " · " + pct + "% of " + total / 60000 + " min complete";
        if ("recovery_break".equals(phase)) { title = "Break time — take 5 minutes 🌿"; text = time + " left · your focus timer is paused."; }
        if ("awaiting_confirmation".equals(phase)) { title = "Your break is over. Ready to focus back?"; text = "Return to CommitX and tap YES when you're ready."; }
        Notification.Builder builder = CommitXNotifications.sessionBuilder(ctx, title, text, pct);
        if (running) builder.setWhen(System.currentTimeMillis() + remaining).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true);
        if (Build.VERSION.SDK_INT >= 31) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return builder.build();
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
        return PendingIntent.getBroadcast(ctx, 1412, new Intent(ctx, StandardCountdownReceiver.class),
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