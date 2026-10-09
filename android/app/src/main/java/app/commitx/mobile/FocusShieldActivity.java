package app.commitx.mobile;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.TextView;


import android.app.Activity;

/**
 * CommitX's own reminder screen, shown on top when a blocked app is opened while
 * Focus Shield is active. Nothing about the other app is modified — the user is
 * simply reminded and offered a way back to CommitX.
 */
public class FocusShieldActivity extends Activity {
    private static final String EXTRA_PKG = "pkg";
    private static final String EXTRA_ENDS_AT = "endsAt";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView remainingView;
    private long endsAt;

    static void show(Context ctx, String blockedPackage, long endsAtMs) {
        try {
            Intent intent = new Intent(ctx, FocusShieldActivity.class)
                    .putExtra(EXTRA_PKG, blockedPackage)
                    .putExtra(EXTRA_ENDS_AT, endsAtMs)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_NO_ANIMATION
                            | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
            ctx.startActivity(intent);
        } catch (Throwable ignored) {}
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setFinishOnTouchOutside(false);

        String pkg = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_PKG);
        endsAt = getIntent() == null ? 0L : getIntent().getLongExtra(EXTRA_ENDS_AT, 0L);
        String label = labelFor(pkg);

        FocusShieldReminderView root = new FocusShieldReminderView(this, label,
                formatRemaining(), v -> {
            try {
                // Return straight to the live timer screen — the web layer
                // re-enters the stored running session (same id, same clock),
                // never the home screen and never a new session.
                startActivity(new Intent(this, MainActivity.class)
                        .setAction(Intent.ACTION_MAIN)
                        .addCategory(Intent.CATEGORY_LAUNCHER)
                        .putExtra(MainActivity.EXTRA_ROUTE, "/session")
                         .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP
                                 | Intent.FLAG_ACTIVITY_SINGLE_TOP
                                | Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Throwable ignored) {}
            finish();
        });
        remainingView = root.remainingView;

        setContentView(root);
        handler.post(tickRemaining);
    }

    private final Runnable tickRemaining = new Runnable() {
        @Override
        public void run() {
            if (remainingView == null) return;
            if (!FocusShieldStore.isActive(FocusShieldActivity.this)) {
                finish();
                return;
            }
            remainingView.setText(formatRemaining());
            handler.postDelayed(this, 1000L);
        }
    };

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    /** The reminder is a reminder, not a trap: back simply dismisses it. */
    @Override
    public void onBackPressed() {
        finish();
    }

    private String formatRemaining() {
        long ms = Math.max(0L, endsAt - System.currentTimeMillis());
        long total = ms / 1000L;
        long h = total / 3600L;
        long m = (total % 3600L) / 60L;
        long s = total % 60L;
        return h > 0
                ? String.format("%d:%02d:%02d", h, m, s)
                : String.format("%02d:%02d", m, s);
    }

    private String labelFor(String pkg) {
        if (pkg == null) return "This app";
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (Throwable t) {
            return "This app";
        }
    }

}
