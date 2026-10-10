package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

/** Notification boundary wake-ups, plus post-reboot restore. Never completes a session. */
public class VerifiedCountdownReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)) {
            VerifiedCountdownService.restoreAfterBoot(context);
            // Blocked apps stay blocked until the committed time; the store
            // already expires itself on its wall-clock end time.
            try {
                if (FocusShieldStore.isActive(context)) FocusShieldService.start(context);
            } catch (Exception ignored) { /* Best effort after boot. */ }
            return;
        }
        JSONObject state = VerifiedCountdownService.read(context);
        if (state != null) VerifiedCountdownService.reconcile(context, state);
    }
}
