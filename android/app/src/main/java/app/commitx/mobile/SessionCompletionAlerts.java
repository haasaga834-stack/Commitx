package app.commitx.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONObject;

/** Durable deadline alert, independent of verification, history and rewards. */
final class SessionCompletionAlerts {
    private static final String CHANNEL = "commitx_session_deadline_v1";
    private static final int ID = 1005;
    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences("commitx_session_deadline", Context.MODE_PRIVATE);
    }
    static boolean handled(Context ctx, String id) {
        return !id.isEmpty() && id.equals(prefs(ctx).getString("handled_id", ""));
    }
    static void reached(Context ctx, JSONObject state, String mode) {
        String id = state.optString("id");
        if (id.isEmpty() || handled(ctx, id)) return;
        // Commit before notification delivery so receiver/service races and process
        // restoration cannot generate another alert. One active session exists.
        if (!prefs(ctx).edit().putString("handled_id", id).commit()) return;
        boolean viewing = MainActivity.isViewingSession();
        if (viewing) MainActivity.notifySessionDeadline();
        if (!SessionCompletionPolicy.shouldAlert(viewing)) return;
        NotificationManager nm = CommitXNotifications.manager(ctx);
        if (nm == null || !nm.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                != android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Session timer finished", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("One alert when your focus timer finishes while you are away.");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(channel);
        }
        Intent intent = new Intent(ctx, MainActivity.class).putExtra(MainActivity.EXTRA_ROUTE, "session")
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(ctx, ID, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        Notification publicVersion = (Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx))
                .setSmallIcon(R.drawable.ic_verified_countdown).setContentTitle("CommitX")
                .setContentText("Your session timer has finished.").setContentIntent(tap).build();
        b.setSmallIcon(R.drawable.ic_verified_countdown).setContentTitle(mode + " timer finished")
                .setContentText("Open CommitX to view your session result.")
                .setProgress(100, 100, false).setAutoCancel(true).setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicVersion)
                .setCategory(Notification.CATEGORY_REMINDER).setContentIntent(tap).setShowWhen(false);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        try { nm.notify(ID, b.build()); } catch (RuntimeException ignored) { /* Permission revoked. */ }
    }
    static void cancel(Context ctx) {
        NotificationManager nm = CommitXNotifications.manager(ctx);
        if (nm != null) nm.cancel(ID);
    }
}