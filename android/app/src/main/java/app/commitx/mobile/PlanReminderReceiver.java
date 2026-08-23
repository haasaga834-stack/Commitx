package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Fires 10 minutes before a planned study session, then re-arms itself. */
public class PlanReminderReceiver extends BroadcastReceiver {
    static final String ACTION_REMIND = "app.commitx.mobile.PLAN_REMINDER";
    static final String EXTRA_ID = "plan_id";
    static final String EXTRA_START = "plan_start";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            PlanStore.scheduleAll(context);
            return;
        }
        if (!ACTION_REMIND.equals(intent.getAction())) return;

        String id = intent.getStringExtra(EXTRA_ID);
        JSONObject plan = PlanStore.find(context, id);
        if (plan == null) return;

        long start = intent.getLongExtra(EXTRA_START, 0L);
        CommitXNotifications.showPlanReminder(
                context,
                plan.optString("subject", "Study"),
                plan.optString("topic", ""),
                plan.optString("time", ""),
                plan.optInt("durationMinutes", 60),
                id);

        // Re-arm for the next occurrence of this repeating plan.
        PlanStore.schedule(context, plan, Math.max(start, System.currentTimeMillis()));
    }
}
