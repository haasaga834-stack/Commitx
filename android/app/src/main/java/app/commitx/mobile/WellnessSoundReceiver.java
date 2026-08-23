package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Plays one native Wellness cue without posting any notification or UI. */
public class WellnessSoundReceiver extends BroadcastReceiver {
    static final String ACTION_SOUND = "app.commitx.mobile.WELLNESS_SOUND";
    static final String EXTRA_KEY = "event_key";
    static final String EXTRA_KIND = "sound_kind";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            WellnessSoundStore.reconcile(context);
            return;
        }
        if (!ACTION_SOUND.equals(action)) return;
        WellnessSoundStore.playNowOnce(
                context,
                intent.getStringExtra(EXTRA_KEY),
                intent.getStringExtra(EXTRA_KIND));
    }
}