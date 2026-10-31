package app.commitx.mobile;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

/**
 * Do Not Disturb owned by a Verified session. CommitX only switches DND off
 * when the session itself asked for it (DND was off at setup), so a user's own
 * DND is never touched. Changing DND needs Android's "Do Not Disturb access".
 */
final class SessionDnd {
    private static final String PREFS = "commitx_session_dnd";
    private static final String KEY_ARMED = "armed";
    private static final String KEY_PENDING_ENABLE = "pending_enable";

    private SessionDnd() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static NotificationManager nm(Context c) {
        return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    static boolean hasAccess(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
        try {
            NotificationManager n = nm(c);
            return n != null && n.isNotificationPolicyAccessGranted();
        } catch (Throwable t) {
            return false;
        }
    }

    static boolean isOn(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
        try {
            NotificationManager n = nm(c);
            if (n == null) return false;
            return n.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL
                    && n.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_UNKNOWN;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Remember that this session turned DND on (only if it is currently off). */
    static void arm(Context c) {
        if (!isOn(c)) prefs(c).edit().putBoolean(KEY_ARMED, true).apply();
    }

    /** Switches DND on now when access is granted. */
    static boolean enableNow(Context c) {
        if (!hasAccess(c)) return false;
        try {
            nm(c).setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
            prefs(c).edit().remove(KEY_PENDING_ENABLE).apply();
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Opens the DND access page; DND is enabled automatically on return. */
    static boolean openAccessSettings(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
        try {
            prefs(c).edit().putBoolean(KEY_PENDING_ENABLE, true).apply();
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            if (!(c instanceof android.app.Activity)) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return true;
        } catch (Throwable t) {
            prefs(c).edit().remove(KEY_PENDING_ENABLE).apply();
            return false;
        }
    }

    static void onResume(Context c) {
        if (!prefs(c).getBoolean(KEY_PENDING_ENABLE, false)) return;
        if (hasAccess(c)) enableNow(c);
        else prefs(c).edit().remove(KEY_PENDING_ENABLE).apply();
    }

    /** Session over: turn off the DND this session turned on. */
    static void release(Context c) {
        SharedPreferences p = prefs(c);
        boolean armed = p.getBoolean(KEY_ARMED, false);
        p.edit().remove(KEY_ARMED).remove(KEY_PENDING_ENABLE).apply();
        if (!armed || !hasAccess(c) || !isOn(c)) return;
        try {
            nm(c).setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
        } catch (Throwable ignored) {}
    }
}
