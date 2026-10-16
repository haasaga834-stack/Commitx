package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Periodic (and boot) screen-time limit check. */
public class ScreenTimeReceiver extends BroadcastReceiver {
    static final String ACTION_CHECK = "app.commitx.mobile.CHECK_SCREEN_TIME";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            ScreenTimeTracker.scheduleChecks(context);
            CommitXNotifications.showScreenTimeDaily(context);
            AppLimitsService.startIfNeeded(context);
            return;
        }
        if (!ACTION_CHECK.equals(action)) return;
        CommitXNotifications.showScreenTimeDaily(context);
        ScreenTimeTracker.checkLimit(context);
    }
}
