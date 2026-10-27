package app.commitx.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.SweepGradient;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Small, movable launcher widget. The launcher owns placement, size and blur support. */
public class StudyGoalWidget extends AppWidgetProvider {
    private static final String TOGGLE = "app.commitx.mobile.WIDGET_TOGGLE";
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
        } else if (Intent.ACTION_DATE_CHANGED.equals(intent.getAction()) || Intent.ACTION_TIME_CHANGED.equals(intent.getAction()) || Intent.ACTION_TIMEZONE_CHANGED.equals(intent.getAction()) || Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) updateAll(ctx);
    }
    private static void update(Context ctx, AppWidgetManager manager, int id) {
        try {
            JSONObject state = StudyWidgetStore.read(ctx);
            boolean today = StudyWidgetStore.day().equals(state.optString("day"));
            int width = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 300);
            RemoteViews views = new RemoteViews(ctx.getPackageName(), width < 260 ? R.layout.study_widget_stacked : R.layout.study_widget);
            Intent open = new Intent(ctx, MainActivity.class).putExtra(MainActivity.EXTRA_ROUTE, "planner").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent tap = PendingIntent.getActivity(ctx, 1600, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, tap);
            views.setOnClickPendingIntent(R.id.widget_more, tap);
            java.util.Date date = new java.util.Date();
            views.setTextViewText(R.id.widget_weekday, new java.text.SimpleDateFormat("EEEE", java.util.Locale.getDefault()).format(date));
            views.setTextViewText(R.id.widget_date, new java.text.SimpleDateFormat("d MMM", java.util.Locale.getDefault()).format(date));
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
                views.setTextViewText(checks[i], done ? "●" : "○");
                views.setTextViewText(texts[i], todo.optString("text"));
                views.setTextColor(texts[i], ctx.getColor(done ? R.color.widget_muted : R.color.widget_text));
                Intent toggle = new Intent(ctx, StudyGoalWidget.class).setAction(TOGGLE).setData(android.net.Uri.parse("commitx-widget://todo/" + android.net.Uri.encode(todo.optString("id")))).putExtra("todo_id", todo.optString("id"));
                views.setOnClickPendingIntent(checks[i], PendingIntent.getBroadcast(ctx, 0, toggle, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
                views.setOnClickPendingIntent(rows[i], tap);
            }
            views.setTextViewText(R.id.widget_more, count > 3 ? "+" + (count - 3) + " more" : count == 0 ? "Add a task →" : "See all →");
            manager.updateAppWidget(id, views);
        } catch (Exception ignored) {}
    }
    private static String time(double minutes) {
        int n = Math.max(0, (int) minutes);
        return n < 60 ? n + "m" : n / 60 + "h" + (n % 60 == 0 ? "" : " " + n % 60 + "m");
    }
    private static Bitmap ring(Context ctx, double minutes, double goal) {
        Bitmap bitmap = Bitmap.createBitmap(360, 360, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        RectF rect = new RectF(22, 22, 338, 338);
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(17); paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(ctx.getColor(R.color.widget_track)); canvas.drawOval(rect, paint);
        paint.setShader(new SweepGradient(180, 180, new int[]{ctx.getColor(R.color.widget_orange), ctx.getColor(R.color.widget_yellow), ctx.getColor(R.color.widget_orange)}, null));
        canvas.drawArc(rect, -90, (float) (360 * Math.min(1, Math.max(0, minutes / Math.max(1, goal)))), false, paint);
        paint.setShader(null); paint.setStyle(Paint.Style.FILL); paint.setTextAlign(Paint.Align.CENTER);
        paint.setColor(ctx.getColor(R.color.widget_text)); paint.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        String current = time(minutes); paint.setTextSize(48);
        while (paint.measureText(current) > 255) paint.setTextSize(paint.getTextSize() - 1);
        canvas.drawText(current, 180, 179, paint);
        paint.setTextSize(32); paint.setColor(ctx.getColor(R.color.widget_muted)); canvas.drawText("/ " + time(goal), 180, 224, paint);
        return bitmap;
    }
}
