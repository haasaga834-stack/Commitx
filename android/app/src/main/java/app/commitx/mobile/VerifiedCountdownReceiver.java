package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

/** Wake-up for notification boundary only, not a session-completion handler. */
public class VerifiedCountdownReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        JSONObject state = VerifiedCountdownService.read(context);
        if (state != null) VerifiedCountdownService.reconcile(context, state);
    }
}