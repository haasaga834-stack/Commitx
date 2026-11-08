package app.commitx.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * 21-Day Challenge midnight check. If the last synced day ended below the daily
 * Verified target (or a whole day passed with no sync), the challenge fails the
 * moment the day closes: one roast notification and the widget streak vanishes.
 * Presentation only — never touches coins or sessions.
 */
public class ChallengeReceiver extends BroadcastReceiver {
    static final String CHECK = "app.commitx.mobile.CHALLENGE_MIDNIGHT";
    private static final int NOTIFICATION_ID = 1310;
    private static final int TARGET_MINUTES = 180;

    private static String key(Calendar c) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime()); }

    /** Arms (or clears) the next local-midnight check from the synced widget state. */
    static void arm(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 1311, new Intent(ctx, ChallengeReceiver.class).setAction(CHECK), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            JSONObject state = StudyWidgetStore.read(ctx);
            if (state.optInt("challengeDay", 0) <= 0 || state.optString("userId", "").isEmpty()) { am.cancel(pi); return; }
            Calendar next = Calendar.getInstance();
            next.add(Calendar.DAY_OF_YEAR, 1);
            next.set(Calendar.HOUR_OF_DAY, 0); next.set(Calendar.MINUTE, 0); next.set(Calendar.SECOND, 5); next.set(Calendar.MILLISECOND, 0);
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
            else am.set(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
        } catch (Throwable ignored) {}
    }

    @Override public void onReceive(Context ctx, Intent intent) {
        try { check(ctx); } catch (Throwable ignored) {}
        arm(ctx);
    }

    static void check(Context ctx) throws Exception {
        JSONObject state = StudyWidgetStore.read(ctx);
        int day = state.optInt("challengeDay", 0);
        if (day <= 0 || state.optString("userId", "").isEmpty()) return;
        Calendar now = Calendar.getInstance();
        String today = key(now);
        String synced = state.optString("day", "");
        if (today.equals(synced)) return; // still the same day: nothing closed yet
        Calendar y = Calendar.getInstance(); y.add(Calendar.DAY_OF_YEAR, -1);
        boolean metLastDay = synced.equals(key(y)) && state.optInt("challengeMinutes", 0) >= TARGET_MINUTES;
        if (metLastDay) return;
        int minutes = synced.equals(key(y)) ? state.optInt("challengeMinutes", 0) : 0;
        state.put("challengeDay", 0);
        state.put("challengeFailedDay", day);
        StudyWidgetStore.replace(ctx, state);
        StudyGoalWidget.updateAll(ctx);
        roast(ctx, day, minutes);
    }

    private static String line(int day, int minutes) {
        String done = minutes <= 0 ? "0 minutes" : (minutes / 60) + "h " + (minutes % 60) + "m";
        String[] lines = {
            "Day " + day + "/21: " + done + " of 3h. Challenge over. Your phone won.",
            "21-Day Challenge failed on Day " + day + ". Reels thank you for your service.",
            "You quit on Day " + day + ". " + done + " studied. Start again, or keep scrolling.",
            "Day " + day + " and you folded. 3 hours was the deal. Challenge gone.",
        };
        return lines[(int) (System.currentTimeMillis() / 1000L % lines.length)];
    }

    private static void roast(Context c, int day, int minutes) {
        if (!AccountabilityEngine.masterOn(c)) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 24 && !nm.areNotificationsEnabled()) return;
        AccountabilityEngine.ensureChannel(c);
        String body = line(day, minutes);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(c, AccountabilityEngine.CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("\uD83D\uDC94 21-Day Challenge failed")
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(AccountabilityEngine.openRoute(c, "/"));
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        nm.notify(NOTIFICATION_ID, b.build());
    }
}
