package app.commitx.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Account-scoped, presentation-only mirror; native actions await the existing planner sync. */
final class StudyWidgetStore {
    private static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences("commitx_study_widget", Context.MODE_PRIVATE); }
    static String day() { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()); }
    static synchronized JSONObject read(Context ctx) {
        try { return new JSONObject(prefs(ctx).getString("state", "{}")); } catch (Exception ignored) { return new JSONObject(); }
    }
    static synchronized JSONArray pending(Context ctx) {
        try { return new JSONArray(prefs(ctx).getString("pending", "[]")); } catch (Exception ignored) { return new JSONArray(); }
    }
    static synchronized void sync(Context ctx, String json) {
        try {
            JSONObject next = new JSONObject(json);
            String uid = next.optString("userId", "");
            if (next.isNull("userId")) uid = "";
            // Clear visible private data on sign-out, but retain account-scoped
            // unsent actions until their owner returns and confirms cloud writes.
            if (uid.isEmpty()) { prefs(ctx).edit().remove("state").apply(); StudyGoalWidget.updateAll(ctx); return; }
            JSONArray todos = next.optJSONArray("todos");
            JSONArray actions = pending(ctx);
            if (todos != null) for (int i = 0; i < actions.length(); i++) {
                JSONObject action = actions.getJSONObject(i);
                if (!uid.equals(action.optString("userId")) || !day().equals(action.optString("day"))) continue;
                for (int j = 0; j < todos.length(); j++) {
                    JSONObject todo = todos.getJSONObject(j);
                    if (todo.optString("id").equals(action.optString("id"))) todo.put("done", action.optBoolean("done"));
                }
            }
            prefs(ctx).edit().putString("state", next.toString()).apply();
            StudyGoalWidget.updateAll(ctx);
        } catch (Exception ignored) {}
    }
    static synchronized void toggle(Context ctx, String id) {
        try {
            JSONObject state = read(ctx);
            if (!day().equals(state.optString("day")) || state.optString("userId").isEmpty()) return;
            JSONArray todos = state.optJSONArray("todos");
            if (todos == null) return;
            for (int i = 0; i < todos.length(); i++) {
                JSONObject todo = todos.getJSONObject(i);
                if (!id.equals(todo.optString("id"))) continue;
                todo.put("done", !todo.optBoolean("done"));
                JSONArray actions = pending(ctx);
                JSONArray next = new JSONArray();
                for (int j = 0; j < actions.length(); j++) {
                    JSONObject action = actions.getJSONObject(j);
                    if (!id.equals(action.optString("id")) || !state.optString("userId").equals(action.optString("userId"))) next.put(action);
                }
                next.put(new JSONObject().put("id", id).put("done", todo.optBoolean("done")).put("userId", state.optString("userId")).put("day", day()));
                prefs(ctx).edit().putString("state", state.toString()).putString("pending", next.toString()).apply();
                break;
            }
            StudyGoalWidget.updateAll(ctx);
        } catch (Exception ignored) {}
    }
    static synchronized void ack(Context ctx, String json) {
        try {
            JSONArray acknowledged = new JSONArray(json), current = pending(ctx), next = new JSONArray();
            for (int i = 0; i < current.length(); i++) {
                JSONObject action = current.getJSONObject(i);
                boolean matched = false;
                for (int j = 0; j < acknowledged.length(); j++) {
                    JSONObject ack = acknowledged.getJSONObject(j);
                    if (action.optString("id").equals(ack.optString("id")) && action.optString("userId").equals(ack.optString("userId")) && action.optString("day").equals(ack.optString("day")) && action.optBoolean("done") == ack.optBoolean("done")) matched = true;
                }
                if (!matched) next.put(action);
            }
            prefs(ctx).edit().putString("pending", next.toString()).apply();
        } catch (Exception ignored) {}
    }
    static boolean invited(Context ctx, String uid) { return prefs(ctx).getBoolean("invited:" + uid, false); }
    static void markInvited(Context ctx, String uid) { prefs(ctx).edit().putBoolean("invited:" + uid, true).apply(); }
}
