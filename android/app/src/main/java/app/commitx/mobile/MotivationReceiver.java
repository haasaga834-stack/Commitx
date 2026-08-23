package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.util.Calendar;

/** Posts the 8:00 AM / 7:00 PM motivation notification, then re-arms itself. */
public class MotivationReceiver extends BroadcastReceiver {
    static final String ACTION_MOTIVATION = "app.commitx.mobile.MOTIVATION";
    static final String EXTRA_MORNING = "motivation_morning";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            MotivationStore.reconcile(context);
            return;
        }
        if (!ACTION_MOTIVATION.equals(intent.getAction())) return;
        if (!MotivationStore.enabled(context)) return;

        boolean morning = intent.getBooleanExtra(EXTRA_MORNING, true);
        Calendar today = Calendar.getInstance();

        CommitXNotifications.showMotivation(
                context,
                MotivationStore.titleFor(context, morning, today),
                MotivationStore.bodyFor(context, morning, today),
                MotivationStore.notificationKey(morning, today));

        // Re-arm tomorrow's alarm for the same slot.
        MotivationStore.reconcile(context);
    }
}
