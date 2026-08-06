package app.commitx.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Local mirror of today's to-do list so the persistent notification can be
 * rebuilt (and toggled) even when the WebView is not running.
 */
final class TodoStore {
    private static final String PREFS = "commitx_todos";
    private static final String KEY_ITEMS = "items_json";
    private static final String KEY_PENDING = "pending_toggles";

    private TodoStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONArray items(Context ctx) {
        try {
            String raw = prefs(ctx).getString(KEY_ITEMS, "[]");
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Throwable t) {
            return new JSONArray();
        }
    }

    /** Replace the mirror with the list pushed by the web layer. */
    static void save(Context ctx, String json) {
        try {
            // Validate before storing so a bad payload can never corrupt the mirror.
            new JSONArray(json == null ? "[]" : json);
            prefs(ctx).edit().putString(KEY_ITEMS, json == null ? "[]" : json).apply();
        } catch (Throwable ignored) {}
    }

    static void clear(Context ctx) {
        prefs(ctx).edit().remove(KEY_ITEMS).apply();
    }

    /** Flip one item locally and return its new done state ("1"/"0"), or null. */
    static Boolean toggle(Context ctx, String id) {
        try {
            JSONArray arr = items(ctx);
            Boolean result = null;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (id != null && id.equals(o.optString("id"))) {
                    boolean next = !o.optBoolean("done", false);
                    o.put("done", next);
                    result = next;
                }
            }
            if (result != null) {
                prefs(ctx).edit().putString(KEY_ITEMS, arr.toString()).apply();
            }
            return result;
        } catch (Throwable t) {
            return null;
        }
    }

    /** Queue an id whose toggle still has to reach the web layer / cloud. */
    static void queuePending(Context ctx, String id) {
        String current = prefs(ctx).getString(KEY_PENDING, "");
        String next = (current == null || current.isEmpty()) ? id : current + "," + id;
        prefs(ctx).edit().putString(KEY_PENDING, next).apply();
    }

    static String[] drainPending(Context ctx) {
        String current = prefs(ctx).getString(KEY_PENDING, "");
        prefs(ctx).edit().remove(KEY_PENDING).apply();
        if (current == null || current.isEmpty()) return new String[0];
        return current.split(",");
    }
}
