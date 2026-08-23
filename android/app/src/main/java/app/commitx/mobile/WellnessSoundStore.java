package app.commitx.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.MediaPlayer;
import android.os.Build;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/** Persistent, idempotent scheduler for sound-only Wellness events. */
final class WellnessSoundStore {
    private static final String PREFS = "commitx_wellness_sounds";
    private static final String KEY_PENDING = "pending";
    private static final String KEY_CONSUMED = "consumed";

    private WellnessSoundStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void schedule(Context ctx, String key, String kind, long fireAt) {
        if (key == null || key.isEmpty() || fireAt <= System.currentTimeMillis()) return;
        try {
            JSONObject consumed = json(ctx, KEY_CONSUMED);
            if (consumed.has(key)) return;
            JSONObject pending = json(ctx, KEY_PENDING);
            JSONObject event = new JSONObject();
            event.put("kind", "end".equals(kind) ? "end" : "start");
            event.put("fireAt", fireAt);
            pending.put(key, event);
            save(ctx, KEY_PENDING, pending);
            arm(ctx, key, event.optString("kind"), fireAt);
        } catch (Throwable ignored) {}
    }

    static synchronized void playNowOnce(Context ctx, String key, String kind) {
        if (key == null || key.isEmpty()) return;
        try {
            JSONObject consumed = json(ctx, KEY_CONSUMED);
            if (consumed.has(key)) return;
            consumed.put(key, System.currentTimeMillis());
            pruneConsumed(consumed);
            save(ctx, KEY_CONSUMED, consumed);

            JSONObject pending = json(ctx, KEY_PENDING);
            pending.remove(key);
            save(ctx, KEY_PENDING, pending);
            cancelAlarm(ctx, key);
            play(ctx, "end".equals(kind));
        } catch (Throwable ignored) {}
    }

    static synchronized void cancelPrefix(Context ctx, String prefix) {
        if (prefix == null || prefix.isEmpty()) return;
        try {
            JSONObject pending = json(ctx, KEY_PENDING);
            List<String> remove = new ArrayList<>();
            Iterator<String> keys = pending.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (key.startsWith(prefix)) remove.add(key);
            }
            for (String key : remove) {
                cancelAlarm(ctx, key);
                pending.remove(key);
            }
            save(ctx, KEY_PENDING, pending);
        } catch (Throwable ignored) {}
    }

    static synchronized void reconcile(Context ctx) {
        try {
            JSONObject pending = json(ctx, KEY_PENDING);
            long now = System.currentTimeMillis();
            List<String> expired = new ArrayList<>();
            Iterator<String> keys = pending.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                JSONObject event = pending.optJSONObject(key);
                if (event == null) {
                    expired.add(key);
                    continue;
                }
                long fireAt = event.optLong("fireAt", 0L);
                if (fireAt <= now) expired.add(key);
                else arm(ctx, key, event.optString("kind", "start"), fireAt);
            }
            for (String key : expired) pending.remove(key);
            save(ctx, KEY_PENDING, pending);
        } catch (Throwable ignored) {}
    }

    private static void arm(Context ctx, String key, String kind, long fireAt) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = pending(ctx, key, kind, PendingIntent.FLAG_UPDATE_CURRENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, fireAt, pi);
            }
        } catch (Throwable ignored) {}
    }

    private static PendingIntent pending(Context ctx, String key, String kind, int extraFlags) {
        Intent intent = new Intent(ctx, WellnessSoundReceiver.class)
                .setAction(WellnessSoundReceiver.ACTION_SOUND)
                .putExtra(WellnessSoundReceiver.EXTRA_KEY, key)
                .putExtra(WellnessSoundReceiver.EXTRA_KIND, kind);
        int immutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE : 0;
        return PendingIntent.getBroadcast(ctx, requestCode(key), intent, extraFlags | immutable);
    }

    private static void cancelAlarm(Context ctx, String key) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = pending(ctx, key, "start", PendingIntent.FLAG_NO_CREATE);
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
            }
        } catch (Throwable ignored) {}
    }

    private static int requestCode(String key) {
        return 400_000_000 + (key.hashCode() & 0x0fffffff);
    }

    private static void play(Context ctx, boolean end) {
        try {
            int sound = end ? R.raw.wellness_end : R.raw.wellness_start;
            MediaPlayer player = MediaPlayer.create(ctx.getApplicationContext(), sound);
            if (player == null) return;
            player.setOnCompletionListener(mp -> {
                try { mp.release(); } catch (Throwable ignored) {}
            });
            player.setOnErrorListener((mp, what, extra) -> {
                try { mp.release(); } catch (Throwable ignored) {}
                return true;
            });
            player.start();
        } catch (Throwable ignored) {}
    }

    private static JSONObject json(Context ctx, String key) {
        try {
            return new JSONObject(prefs(ctx).getString(key, "{}"));
        } catch (Throwable ignored) {
            return new JSONObject();
        }
    }

    private static void save(Context ctx, String key, JSONObject value) {
        prefs(ctx).edit().putString(key, value.toString()).apply();
    }

    private static void pruneConsumed(JSONObject consumed) {
        long cutoff = System.currentTimeMillis() - 7L * 24L * 60L * 60L * 1000L;
        List<String> remove = new ArrayList<>();
        Iterator<String> keys = consumed.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            if (consumed.optLong(key, 0L) < cutoff) remove.add(key);
        }
        for (String key : remove) consumed.remove(key);
    }
}