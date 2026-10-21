package app.commitx.mobile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;
public class StandardCountdownReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        // Boot and app updates kill the process: re-derive deadlines from the
        // persisted absolute end time. Manual clock/timezone changes do not move
        // the monotonic deadline, so they only refresh the notification.
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) { StandardCountdownService.restoreAfterBoot(context); return; }
        JSONObject state = StandardCountdownService.read(context);
        if (state != null) StandardCountdownService.reconcile(context, state);
    }
}
