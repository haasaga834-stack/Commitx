package app.commitx.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** All CommitX notifications: today's to-do list, live study progress, screen-time limit. */
final class CommitXNotifications {
    static final String CHANNEL_TODOS = "commitx_todos";
    static final String CHANNEL_SESSION = "commitx_session";
    static final String CHANNEL_SCREEN_TIME = "commitx_screen_time";
    static final String CHANNEL_PLANS = "commitx_plans";

    static final int ID_TODOS = 1001;
    static final int ID_SESSION = 1002;
    static final int ID_SCREEN_TIME = 1003;
    static final int ID_PLAN_BASE = 1100;


    private CommitXNotifications() {}

    static NotificationManager manager(Context ctx) {
        return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = manager(ctx);
        if (nm == null) return;

        NotificationChannel todos = new NotificationChannel(
                CHANNEL_TODOS, "Today's to-do", NotificationManager.IMPORTANCE_LOW);
        todos.setDescription("A persistent checklist of today's tasks.");
        todos.setShowBadge(false);

        NotificationChannel session = new NotificationChannel(
                CHANNEL_SESSION, "Study progress", NotificationManager.IMPORTANCE_LOW);
        session.setDescription("Live timer and daily study progress.");
        session.setShowBadge(false);

        NotificationChannel limit = new NotificationChannel(
                CHANNEL_SCREEN_TIME, "Screen time limit", NotificationManager.IMPORTANCE_DEFAULT);
        limit.setDescription("Alerts you when your daily screen time limit is reached.");

        NotificationChannel plans = new NotificationChannel(
                CHANNEL_PLANS, "Study reminders", NotificationManager.IMPORTANCE_HIGH);
        plans.setDescription("Reminds you 10 minutes before a planned study session.");

        nm.createNotificationChannel(todos);
        nm.createNotificationChannel(session);
        nm.createNotificationChannel(limit);
        nm.createNotificationChannel(plans);
    }


    private static int flags(int extra) {
        int base = PendingIntent.FLAG_UPDATE_CURRENT | extra;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            base |= PendingIntent.FLAG_IMMUTABLE;
        }
        return base;
    }

    private static PendingIntent openApp(Context ctx, String route, int requestCode) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.putExtra(MainActivity.EXTRA_ROUTE, route);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, requestCode, intent, flags(0));
    }

    /* --------------------------- Today's to-do list -------------------------- */

    static void showTodos(Context ctx) {
        NotificationManager nm = manager(ctx);
        if (nm == null) return;
        ensureChannels(ctx);

        JSONArray items = TodoStore.items(ctx);
        if (items.length() == 0) {
            nm.cancel(ID_TODOS);
            return;
        }

        int done = 0;
        Notification.InboxStyle style = new Notification.InboxStyle();
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.optJSONObject(i);
            if (o == null) continue;
            boolean isDone = o.optBoolean("done", false);
            if (isDone) done++;
            if (i < 6) {
                style.addLine((isDone ? "\u2713 " : "\u25CB ") + o.optString("text"));
            }
        }
        if (items.length() > 6) {
            style.setSummaryText("+" + (items.length() - 6) + " more");
        }

        String title = "Today's to-do \u00B7 " + done + "/" + items.length();

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(ctx, CHANNEL_TODOS)
                : new Notification.Builder(ctx);

        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(firstOpenTask(items))
                .setStyle(style)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setContentIntent(openApp(ctx, "planner", 10));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            b.setVisibility(Notification.VISIBILITY_PUBLIC);
        }

        // Up to three one-tap "complete" actions for the next open tasks.
        int added = 0;
        for (int i = 0; i < items.length() && added < 3; i++) {
            JSONObject o = items.optJSONObject(i);
            if (o == null || o.optBoolean("done", false)) continue;
            String id = o.optString("id");
            Intent intent = new Intent(ctx, TodoActionReceiver.class)
                    .setAction(TodoActionReceiver.ACTION_TOGGLE)
                    .putExtra(TodoActionReceiver.EXTRA_ID, id);
            PendingIntent pi = PendingIntent.getBroadcast(
                    ctx, 100 + i, intent, flags(0));
            b.addAction(new Notification.Action.Builder(
                    android.R.drawable.checkbox_on_background,
                    "Done: " + shorten(o.optString("text")),
                    pi).build());
            added++;
        }

        nm.notify(ID_TODOS, b.build());
    }

    private static String firstOpenTask(JSONArray items) {
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.optJSONObject(i);
            if (o != null && !o.optBoolean("done", false)) return o.optString("text");
        }
        return "All tasks complete \u2014 nicely done.";
    }

    private static String shorten(String text) {
        if (text == null) return "Task";
        String t = text.trim();
        return t.length() <= 18 ? t : t.substring(0, 17) + "\u2026";
    }

    static void cancelTodos(Context ctx) {
        NotificationManager nm = manager(ctx);
        if (nm != null) nm.cancel(ID_TODOS);
    }

    /* ------------------------- Live study progress -------------------------- */

    static void showSession(Context ctx, String title, String text, int progress) {
        NotificationManager nm = manager(ctx);
        if (nm == null) return;
        ensureChannels(ctx);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(ctx, CHANNEL_SESSION)
                : new Notification.Builder(ctx);

        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setProgress(100, Math.max(0, Math.min(100, progress)), false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setContentIntent(openApp(ctx, "session", 11));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            b.setVisibility(Notification.VISIBILITY_PUBLIC);
        }

        nm.notify(ID_SESSION, b.build());
    }

    static void cancelSession(Context ctx) {
        NotificationManager nm = manager(ctx);
        if (nm != null) nm.cancel(ID_SESSION);
    }

    /* --------------------------- Screen time limit -------------------------- */

    static void showScreenTimeLimit(Context ctx, int otherMinutes, int limitMinutes) {
        NotificationManager nm = manager(ctx);
        if (nm == null) return;
        ensureChannels(ctx);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(ctx, CHANNEL_SCREEN_TIME)
                : new Notification.Builder(ctx);

        String text = "You've used " + ScreenTimeTracker.format(otherMinutes)
                + " on other apps today \u2014 your limit is "
                + ScreenTimeTracker.format(limitMinutes) + ".";

        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Screen time limit reached")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(openApp(ctx, "", 12));

        nm.notify(ID_SCREEN_TIME, b.build());
    }
}
