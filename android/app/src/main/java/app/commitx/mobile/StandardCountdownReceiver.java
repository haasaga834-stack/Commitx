package app.commitx.mobile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;
public class StandardCountdownReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent != null && Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { StandardCountdownService.restoreAfterBoot(context); return; }
        JSONObject state = StandardCountdownService.read(context);
        if (state != null) StandardCountdownService.reconcile(context, state);
    }
}
