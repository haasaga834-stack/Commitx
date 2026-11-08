package app.commitx.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Small, movable launcher widget. The launcher owns placement, size and blur support. */
public class StudyGoalWidget extends AppWidgetProvider {
    private static final String TOGGLE = "app.commitx.mobile.WIDGET_TOGGLE";
    private static final String REFRESH = "app.commitx.mobile.WIDGET_LIVE_REFRESH";
    /** Inexact minute tick so the live countdown keeps moving while CommitX is in the background. */
    private static void scheduleRefresh(Context ctx, long at) {
        try {
            android.app.AlarmManager am = (android.app.AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 1602, new Intent(ctx, StudyGoalWidget.class).setAction(REFRESH), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            if (am != null) am.set(android.app.AlarmManager.RTC, at, pi);
        } catch (Exception ignored) {}
    }
    /** Whole hours stay plain ("2h"); partial hours keep one decimal ("2.5h"). */
    private static String hoursText(int minutes) {
        float hours = minutes / 60f;
        return (hours == Math.floor(hours) ? String.valueOf((int) hours) : String.format(java.util.Locale.US, "%.1f", hours)) + "h";
    }
    static void updateAll(Context ctx) {
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        for (int id : manager.getAppWidgetIds(new ComponentName(ctx, StudyGoalWidget.class))) update(ctx, manager, id);
    }
    @Override public void onUpdate(Context ctx, AppWidgetManager manager, int[] ids) { for (int id : ids) update(ctx, manager, id); }
    @Override public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager manager, int id, Bundle options) { update(ctx, manager, id); }
    @Override public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (TOGGLE.equals(intent.getAction())) {
            String id = intent.getStringExtra("todo_id");
            if (id != null) {
                StudyWidgetStore.toggle(ctx, id);
                MainActivity.notifyWidgetChanged();
            }
        } else if (REFRESH.equals(intent.getAction())) {
            updateAll(ctx);
        } else if (Intent.ACTION_DATE_CHANGED.equals(intent.getAction()) || Intent.ACTION_TIME_CHANGED.equals(intent.getAction()) || Intent.ACTION_TIMEZONE_CHANGED.equals(intent.getAction()) || Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) updateAll(ctx);
    }
    private static void update(Context ctx, AppWidgetManager manager, int id) {
        try {
            JSONObject state = StudyWidgetStore.read(ctx);
            boolean today = StudyWidgetStore.day().equals(state.optString("day"));
            // Many launchers report a small MIN_WIDTH in portrait even for a 4-cell widget,
            // which wrongly picked the tall stacked layout. Use the larger reported width.
            Bundle opts = manager.getAppWidgetOptions(id);
            int width = Math.max(opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 300),
                    opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0));
            RemoteViews views = new RemoteViews(ctx.getPackageName(), width < 200 ? R.layout.study_widget_stacked : R.layout.study_widget);
            long now = System.currentTimeMillis();
            long liveStart = state.optLong("sessionStartMs", 0), liveEnd = state.optLong("sessionEndMs", 0);
            boolean live = liveEnd > now && liveStart > 0 && liveStart < liveEnd;
            Intent open = new Intent(ctx, MainActivity.class).putExtra(MainActivity.EXTRA_ROUTE, live ? "session" : "planner").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent tap = PendingIntent.getActivity(ctx, live ? 1601 : 1600, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, tap);
            views.setOnClickPendingIntent(R.id.widget_more, tap);
            int minutes = today ? state.optInt("minutes", 0) : 0;
            int goalMinutes = today ? state.optInt("goalMinutes", 0) : 0;
            int progress = goalMinutes > 0 ? Math.min(1000, Math.round(1000f * minutes / goalMinutes)) : 0;
            if (live) {
                int liveProgress = (int) Math.min(1000, Math.max(0, 1000L * (now - liveStart) / (liveEnd - liveStart)));
                views.setProgressBar(R.id.widget_ring, 1000, liveProgress, false);
                // Per-second countdown is drawn by the launcher itself (no wakeups).
                views.setViewVisibility(R.id.widget_hours, View.GONE);
                views.setViewVisibility(R.id.widget_timer, View.VISIBLE);
                views.setChronometer(R.id.widget_timer, android.os.SystemClock.elapsedRealtime() + (liveEnd - now), null, true);
                views.setChronometerCountDown(R.id.widget_timer, true);
                views.setTextViewText(R.id.widget_hours_label, "LEFT");
                views.setTextViewText(R.id.widget_hours_goal, "\u25CF LIVE");
                views.setViewVisibility(R.id.widget_quick, View.GONE);
                scheduleRefresh(ctx, Math.min(liveEnd + 1000, now + 60000));
            } else {
                views.setChronometer(R.id.widget_timer, android.os.SystemClock.elapsedRealtime(), null, false);
                views.setViewVisibility(R.id.widget_timer, View.GONE);
                views.setViewVisibility(R.id.widget_hours, View.VISIBLE);
                views.setViewVisibility(R.id.widget_quick, View.VISIBLE);
                Intent quick = new Intent(ctx, MainActivity.class).putExtra(MainActivity.EXTRA_ROUTE, "commit?mode=verified&duration=30&quick=1").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                views.setOnClickPendingIntent(R.id.widget_quick, PendingIntent.getActivity(ctx, 1603, quick, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
                views.setProgressBar(R.id.widget_ring, 1000, progress, false);
                String h = hoursText(minutes);
                views.setTextViewText(R.id.widget_hours, h.substring(0, h.length() - 1));
                views.setTextViewText(R.id.widget_hours_label, "HRS");
                views.setTextViewText(R.id.widget_hours_goal, "of " + hoursText(goalMinutes));
            }
            int streak = state.optInt("streak", 0);
            int challengeDay = state.optInt("challengeDay", 0);
            views.setViewVisibility(R.id.widget_streak, (streak > 0 || challengeDay > 0) ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.widget_streak, challengeDay > 0
                    ? "\uD83D\uDD25 DAY " + challengeDay + "/21"
                    : "\uD83D\uDD25 " + streak + " day streak");
            JSONArray todos = today ? state.optJSONArray("todos") : new JSONArray();
            int count = todos == null ? 0 : todos.length();
            int[] rows = {R.id.widget_row_0, R.id.widget_row_1, R.id.widget_row_2};
            int[] checks = {R.id.widget_check_0, R.id.widget_check_1, R.id.widget_check_2};
            int[] texts = {R.id.widget_task_0, R.id.widget_task_1, R.id.widget_task_2};
            for (int i = 0; i < 3; i++) {
                views.setViewVisibility(rows[i], i < count ? View.VISIBLE : View.GONE);
                if (i >= count || todos == null) continue;
                JSONObject todo = todos.getJSONObject(i);
                boolean done = todo.optBoolean("done");
                views.setImageViewResource(checks[i], done ? R.drawable.widget_check_on : R.drawable.widget_check_off);
                android.text.SpannableString label = new android.text.SpannableString(todo.optString("text"));
                if (done) label.setSpan(new android.text.style.StrikethroughSpan(), 0, label.length(), 0);
                views.setTextViewText(texts[i], label);
                views.setTextColor(texts[i], ctx.getColor(done ? R.color.widget_muted : R.color.widget_text));
                Intent toggle = new Intent(ctx, StudyGoalWidget.class).setAction(TOGGLE).setData(android.net.Uri.parse("commitx-widget://todo/" + android.net.Uri.encode(todo.optString("id")))).putExtra("todo_id", todo.optString("id"));
                views.setOnClickPendingIntent(checks[i], PendingIntent.getBroadcast(ctx, 0, toggle, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
                views.setOnClickPendingIntent(rows[i], tap);
            }
            int doneCount = 0;
            for (int i = 0; todos != null && i < count; i++) if (todos.getJSONObject(i).optBoolean("done")) doneCount++;
            views.setViewVisibility(R.id.widget_done, count > 0 ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.widget_done, doneCount + "/" + count + " DONE");
            views.setTextViewText(R.id.widget_more, count > 3 ? "+" + (count - 3) + " more" : count == 0 ? "Add a task →" : "See all →");
            manager.updateAppWidget(id, views);
        } catch (Exception ignored) {}
    }
}
