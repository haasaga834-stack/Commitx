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
        boolean boot = Intent.ACTION_BOOT_COMPLETED.equals(action);
        if (!boot && !ACTION_CHECK.equals(action)) return;
        PendingResult pending = goAsync();
        Context app = context.getApplicationContext();
        ScreenTimeDetails.runInBackground(() -> {
            try {
                if (boot) {
                    ScreenTimeTracker.scheduleChecks(app);
                    AppLimitsService.startIfNeeded(app);
                }
                int[] totals = ScreenTimeTracker.totals(app, true);
                CommitXNotifications.showScreenTimeDaily(app, totals);
                if (!boot) ScreenTimeTracker.checkLimit(app, totals);
            } finally { pending.finish(); }
        });
    }
}
