package app.commitx.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;
import java.util.Random;

/**
 * Accountability / Roast notifications.
 *
 * Runs entirely on the device: the web app reports commitment events
 * (drafted, started, ended, app opened) and this engine arms ONE randomized
 * alarm for the next nudge. When the alarm fires \u2014 even with CommitX closed or
 * the phone locked \u2014 the engine re-reads the latest state, so it never nags
 * about something that already changed. Cooldowns, a daily cap, quiet hours and
 * a single notification id keep it from ever spamming.
 */
public class AccountabilityEngine extends BroadcastReceiver {
    static final String ACTION_FIRE = "app.commitx.mobile.ACCOUNTABILITY";
    static final String CHANNEL = "commitx_accountability";
    static final int NOTIFICATION_ID = 1300;

    private static final String PREFS = "commitx_accountability";
    private static final int REQ_MAIN = 4201;
    private static final int REQ_NEAR_END = 4202;

    static final int DAILY_LIMIT = 3;
    static final long COOLDOWN_MS = 2 * 60 * 60 * 1000L;
    static final int QUIET_START_HOUR = 22; // 10 PM
    static final int QUIET_END_HOUR = 8;    // 8 AM

    static final String K_PENDING = "pending", K_ABANDONED = "abandoned", K_REPEAT = "repeat_fail",
            K_KEPT = "kept", K_NEAR_END = "near_end", K_INACTIVE = "inactive", K_STREAK = "streak";

    /* --------------------------- Message bank --------------------------- */
    // Placeholders: {target} {done} {streak} {fails}. Behaviour only \u2014 never personal.
    private static String[] bank(String kind, String style) {
        switch (kind) {
            case K_PENDING:
                switch (style) {
                    case "gentle": return new String[] {
                            "Your {target} commitment is waiting for you \uD83D\uDC40",
                            "Your {target} commitment is still here whenever you're ready \uD83C\uDF31" };
                    case "savage": return new String[] {
                            "Why did you install CommitX if you're not going to keep your commitments?",
                            "{target} promised. 0 minutes started. Bold strategy." };
                    case "brutal": return new String[] {
                            "Your {target} commitment has been waiting so long it's started journaling about you.",
                            "You made a promise and then ghosted it. Your commitment deserves better." };
                    default: return new String[] {
                            "Your {target} commitment is still waiting. \uD83D\uDC40",
                            "You committed to {target}. Your commitment would like to know where you are." };
                }
            case K_ABANDONED:
                switch (style) {
                    case "gentle": return new String[] {
                            "You gave it {done}. Want to try again? Every attempt counts \uD83C\uDF31",
                            "{done} done today. A fresh start is one tap away." };
                    case "savage": return new String[] {
                            "You promised {target}. You gave it {done}. We need to talk.",
                            "{done} out of {target}. Your goal saw you leave." };
                    case "brutal": return new String[] {
                            "Another commitment abandoned. At this point, your promises need a backup plan.",
                            "{target} promised, {done} delivered. Even your excuses are tired." };
                    default: return new String[] {
                            "You promised {target}. You gave it {done}. Want to try again?",
                            "{done} of a {target} commitment. Bold of you to call that a session." };
                }
            case K_REPEAT:
                switch (style) {
                    case "gentle": return new String[] {
                            "A few tough sessions lately. Try a shorter one today \u2014 you've got this \uD83D\uDC9B" };
                    case "savage": return new String[] {
                            "{fails} broken commitments in a row. Your goals are filing a complaint.",
                            "Your commitments are starting to think you're avoiding them." };
                    case "brutal": return new String[] {
                            "{fails} abandoned commitments. Your promises have trust issues now. Fix it.",
                            "At {fails} in a row, quitting is officially your hobby. Prove it wrong." };
                    default: return new String[] {
                            "Your commitments are starting to think you're avoiding them.",
                            "{fails} unfinished commitments. That's a pattern, not a coincidence." };
                }
            case K_KEPT:
                switch (style) {
                    case "gentle": return new String[] { "Commitment kept \uD83C\uDF31 Proud of you. That was {target} well spent." };
                    case "savage": return new String[] { "COMMITMENT KEPT. \uD83D\uDD25 Who are you and what did you do with the old you?" };
                    case "brutal": return new String[] { "COMMITMENT KEPT. \uD83D\uDD25 Fine. Respect. Now do it again tomorrow." };
                    default: return new String[] {
                            "COMMITMENT KEPT. \uD83D\uDD25 See? You actually did it.",
                            "{target} done. \uD83D\uDD25 Your past self is shocked. Your future self is grateful." };
                }
            case K_NEAR_END:
                switch (style) {
                    case "gentle": return new String[] { "Almost there \u2014 just a few minutes left on your {target} commitment \uD83C\uDF1F" };
                    case "savage": return new String[] { "Minutes away from finishing. Quitting now would be legendary-level embarrassing." };
                    case "brutal": return new String[] { "You're THIS close. Leave now and your commitment will never let you forget it." };
                    default: return new String[] { "Almost done. Don't make the last few minutes the plot twist." };
                }
            case K_STREAK:
                switch (style) {
                    case "gentle": return new String[] { "Day {streak} of your streak \uD83D\uDD25 One session today keeps it alive." };
                    case "savage": return new String[] { "Day {streak}. It would be a shame if today broke it. A real shame." };
                    case "brutal": return new String[] { "{streak} days of discipline, about to be ruined by one lazy day. Your call." };
                    default: return new String[] { "Day {streak}. Don't let today's commitment become the one that breaks it." };
                }
            default: // K_INACTIVE
                switch (style) {
                    case "gentle": return new String[] { "It's been a while \uD83D\uDC4B A short focus session might feel good today." };
                    case "savage": return new String[] { "Your goals called. You left them on read." };
                    case "brutal": return new String[] { "Days without a commitment. Your goals are packing their bags." };
                    default: return new String[] {
                            "CommitX misses you. Your goals? Honestly, they're a bit offended.",
                            "No commitments lately. Your future self has some questions." };
                }
        }
    }

    private static String titleFor(String kind) {
        if (K_KEPT.equals(kind)) return "\uD83D\uDD25 CommitX \u00B7 Commitment kept";
        if (K_NEAR_END.equals(kind)) return "\u23F3 CommitX";
        return "\uD83D\uDD25 CommitX";
    }

    /* ------------------------------ Prefs ------------------------------- */

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    // Built-in tone: legacy preferences must not change the notification style.
    static String style(Context c) { return "brutal"; }

    static boolean masterOn(Context c) { return MotivationStore.enabled(c); }

    static void setStyle(Context c, String style) {
        // Preserve bridge compatibility while retiring user-selectable tones.
        prefs(c).edit().putString("style", "brutal").apply();
        reconcile(c);
    }

    /* ------------------------------ Events ------------------------------ */

    /** A commitment was set up but the user left without starting it. */
    static void onDrafted(Context c, int targetMin) {
        if (targetMin <= 0) return;
        prefs(c).edit().putInt("pending_target", targetMin).putLong("pending_at", now()).apply();
        armMain(c, K_PENDING, randomBetween(25, 75));
    }

    static void onStarted(Context c, int targetMin, long startedAt) {
        long started = startedAt > 0 ? startedAt : now();
        prefs(c).edit()
                .remove("pending_target").remove("pending_at")
                .putInt("active_target", targetMin).putLong("active_started", started)
                .putLong("last_activity", now()).apply();
        cancel(c, REQ_MAIN);
        clearShown(c);
        long endAt = started + targetMin * 60_000L;
        // Only longer sessions get a "nearly there" nudge, and only sometimes.
        if (targetMin >= 45 && new Random().nextInt(100) < 60) {
            long at = endAt - randomBetween(4, 9) * 60_000L;
            if (at > now()) armAt(c, REQ_NEAR_END, K_NEAR_END, at);
        }
    }

    static void onEnded(Context c, String status, int targetMin, int doneMin, int streak, int failStreak) {
        SharedPreferences.Editor e = prefs(c).edit()
                .remove("active_target").remove("active_started")
                .putString("last_status", status).putInt("last_target", targetMin)
                .putInt("last_done", Math.max(0, doneMin)).putLong("last_end", now())
                .putInt("streak", Math.max(0, streak)).putInt("fail_streak", Math.max(0, failStreak))
                .putLong("last_activity", now());
        e.apply();
        cancel(c, REQ_NEAR_END);
        if ("completed".equals(status)) {
            fire(c, K_KEPT, true);
            // Next nudge: tomorrow, protect the streak (randomized).
            armMain(c, streak >= 2 ? K_STREAK : K_INACTIVE, randomBetween(18 * 60, 26 * 60));
        } else {
            armMain(c, failStreak >= 3 ? K_REPEAT : K_ABANDONED, randomBetween(20, 90));
        }
    }

    /** App opened: the user is here, so clear the nudge and plan the next one. */
    static void onAppOpened(Context c, int streak, int failStreak) {
        prefs(c).edit().putInt("streak", Math.max(0, streak))
                .putInt("fail_streak", Math.max(0, failStreak))
                .putLong("last_activity", now()).apply();
        clearShown(c);
        reconcile(c);
    }

    /** Ensures exactly one future nudge is armed (idempotent). */
    static void reconcile(Context c) {
        if (!enabledNow(c)) { cancelAll(c); return; }
        SharedPreferences p = prefs(c);
        long next = p.getLong("next_at", 0);
        if (next > now()) { armAt(c, REQ_MAIN, p.getString("next_kind", K_INACTIVE), next); return; }
        if (p.contains("pending_target")) armMain(c, K_PENDING, randomBetween(30, 90));
        else armMain(c, p.getInt("streak", 0) >= 2 ? K_STREAK : K_INACTIVE, randomBetween(20 * 60, 30 * 60));
    }

    /* ----------------------------- Firing ------------------------------- */

    @Override
    public void onReceive(Context c, Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { reconcile(c); return; }
        if (!ACTION_FIRE.equals(intent.getAction())) return;
        String kind = intent.getStringExtra("kind");
        if (!K_NEAR_END.equals(kind)) prefs(c).edit().remove("next_at").apply();
        fire(c, resolve(c, kind == null ? K_INACTIVE : kind), false);
    }

    /** Re-checks the real state at fire time so a stale nudge is never sent. */
    private static String resolve(Context c, String kind) {
        SharedPreferences p = prefs(c);
        boolean active = p.contains("active_started")
                && now() < p.getLong("active_started", 0) + p.getInt("active_target", 0) * 60_000L + 5 * 60_000L;
        if (K_NEAR_END.equals(kind)) return active ? kind : null;
        if (active) return null; // never interrupt a running session
        if (K_PENDING.equals(kind) && !p.contains("pending_target")) return K_INACTIVE;
        if ((K_ABANDONED.equals(kind) || K_REPEAT.equals(kind))
                && now() - p.getLong("last_end", 0) > 12 * 60 * 60 * 1000L) return K_INACTIVE;
        if (K_INACTIVE.equals(kind) && now() - p.getLong("last_activity", 0) < 6 * 60 * 60 * 1000L) {
            armMain(c, K_INACTIVE, randomBetween(6 * 60, 10 * 60));
            return null;
        }
        return kind;
    }

    private static void fire(Context c, String kind, boolean immediate) {
        if (kind == null || !enabledNow(c)) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 24 && !nm.areNotificationsEnabled()) return; // permission denied

        SharedPreferences p = prefs(c);
        String day = MotivationStore.dayKey(Calendar.getInstance());
        int sentToday = day.equals(p.getString("sent_day", "")) ? p.getInt("sent_count", 0) : 0;
        boolean exempt = K_KEPT.equals(kind) || K_NEAR_END.equals(kind);

        if (!exempt) {
            if (inQuietHours()) { armAt(c, REQ_MAIN, kind, quietEnd() + randomBetween(0, 90) * 60_000L); return; }
            if (sentToday >= DAILY_LIMIT) { armAt(c, REQ_MAIN, kind, quietEnd() + randomBetween(60, 240) * 60_000L); return; }
            long since = now() - p.getLong("last_sent", 0);
            if (since < COOLDOWN_MS) { armAt(c, REQ_MAIN, kind, now() + COOLDOWN_MS - since + randomBetween(5, 40) * 60_000L); return; }
        }

        String body = fill(c, pick(c, kind));
        ensureChannel(c);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(titleFor(kind))
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(openRoute(c, routeFor(c, kind)));
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        if (Build.VERSION.SDK_INT >= 21) b.setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPublicVersion(new Notification.Builder(c).setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle("\uD83D\uDD25 CommitX").setContentText("Your commitment has something to say.").build());
        nm.notify(NOTIFICATION_ID, b.build()); // one id: a new nudge replaces, never stacks

        SharedPreferences.Editor e = p.edit().putString("sent_day", day).putInt("sent_count", sentToday + 1);
        if (!exempt) e.putLong("last_sent", now());
        e.apply();
    }

    private static String routeFor(Context c, String kind) {
        SharedPreferences p = prefs(c);
        switch (kind) {
            case K_NEAR_END: return "/session";
            case K_KEPT: return "/history";
            case K_PENDING: return "/commit?duration=" + clampDur(p.getInt("pending_target", 60));
            case K_ABANDONED:
            case K_REPEAT: return "/commit?duration=" + clampDur(p.getInt("last_target", 60));
            default: return "/commit";
        }
    }

    private static int clampDur(int m) { return Math.max(25, Math.min(360, m)); }

    private static String pick(Context c, String kind) {
        String[] options = bank(kind, style(c));
        SharedPreferences p = prefs(c);
        int last = p.getInt("last_idx_" + kind, -1);
        int idx = new Random().nextInt(options.length);
        if (options.length > 1 && idx == last) idx = (idx + 1) % options.length;
        p.edit().putInt("last_idx_" + kind, idx).apply();
        return options[idx];
    }

    private static String fill(Context c, String t) {
        SharedPreferences p = prefs(c);
        int target = p.contains("pending_target") ? p.getInt("pending_target", 60)
                : p.contains("active_target") ? p.getInt("active_target", 60) : p.getInt("last_target", 60);
        return t.replace("{target}", dur(target))
                .replace("{done}", dur(p.getInt("last_done", 0)))
                .replace("{streak}", String.valueOf(p.getInt("streak", 0)))
                .replace("{fails}", String.valueOf(p.getInt("fail_streak", 0)));
    }

    static String dur(int min) {
        if (min <= 0) return "0 minutes";
        if (min < 60) return min + (min == 1 ? " minute" : " minutes");
        int h = min / 60, m = min % 60;
        String hs = h + (h == 1 ? " hour" : " hours");
        return m == 0 ? hs : hs + " " + m + " min";
    }

    /* ----------------------------- Helpers ------------------------------ */

    private static boolean enabledNow(Context c) { return masterOn(c); }

    private static long now() { return System.currentTimeMillis(); }

    private static long randomBetween(int minMinutes, int maxMinutes) {
        return minMinutes + new Random().nextInt(Math.max(1, maxMinutes - minMinutes + 1));
    }

    static boolean inQuietHours() {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
    }

    private static long quietEnd() {
        Calendar c = Calendar.getInstance();
        if (c.get(Calendar.HOUR_OF_DAY) >= QUIET_END_HOUR) c.add(Calendar.DAY_OF_YEAR, 1);
        c.set(Calendar.HOUR_OF_DAY, QUIET_END_HOUR);
        c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static void armMain(Context c, String kind, long inMinutes) {
        armAt(c, REQ_MAIN, kind, now() + inMinutes * 60_000L);
    }

    private static void armAt(Context c, int req, String kind, long at) {
        if (!enabledNow(c)) return;
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            if (req == REQ_MAIN) prefs(c).edit().putLong("next_at", at).putString("next_kind", kind).apply();
            PendingIntent pi = pending(c, req, kind);
            // Inexact-while-idle: respects battery/Doze; randomized timing anyway.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.set(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (Throwable ignored) {}
    }

    private static PendingIntent pending(Context c, int req, String kind) {
        Intent i = new Intent(c, AccountabilityEngine.class).setAction(ACTION_FIRE);
        if (kind != null) i.putExtra("kind", kind);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(c, req, i, f);
    }

    private static void cancel(Context c, int req) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(pending(c, req, null));
            if (req == REQ_MAIN) prefs(c).edit().remove("next_at").apply();
        } catch (Throwable ignored) {}
    }

    static void cancelAll(Context c) { cancel(c, REQ_MAIN); cancel(c, REQ_NEAR_END); }

    static void clearShown(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
    }

    private static PendingIntent openRoute(Context c, String route) {
        Intent intent = new Intent(c, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.putExtra(MainActivity.EXTRA_ROUTE, route);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, 30, intent, f);
    }

    /** High importance = heads-up banner when the OS and user allow it. */
    private static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Accountability (Roast Mode)",
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Playful nudges about the commitments you made.");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }
}
