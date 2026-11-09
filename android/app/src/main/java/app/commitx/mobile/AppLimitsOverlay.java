package app.commitx.mobile;

import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

/**
 * CommitX reminder shown on top of an app whose daily limit is used up.
 * Shows the app icon, saved limit and a live midnight countdown; the blocked app is never
 * modified, hidden or removed. The block lifts automatically at midnight.
 */
final class AppLimitsOverlay {
    private final Context ctx;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private AppLimitsReminderView root;
    private long endsAt;

    AppLimitsOverlay(Context ctx) {
        this.ctx = ctx;
    }

    boolean isShowing() {
        return root != null;
    }

    void show(String blockedPackage, long endsAtMs) {
        this.endsAt = endsAtMs;
        if (root != null) return; // already covering; message stays the same
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return;

            AppLimitsReminderView view = new AppLimitsReminderView(ctx, blockedPackage,
                    AppLimitsStore.labelFor(ctx, blockedPackage),
                    AppLimitsStore.limitSummary(ctx, blockedPackage), v -> {
                try {
                    ctx.startActivity(new Intent(ctx, MainActivity.class)
                            .setAction(Intent.ACTION_MAIN)
                            .addCategory(Intent.CATEGORY_LAUNCHER)
                            .putExtra(MainActivity.EXTRA_ROUTE, "/screen-time")
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP
                                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                                    | Intent.FLAG_ACTIVITY_NEW_TASK));
                    // Keep protecting the limited app until the worker confirms
                    // CommitX (or another app) resumed. No timed bypass window.
                } catch (Throwable ignored) {}
            });
            view.setResetRemaining(endsAt - System.currentTimeMillis());

            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;
            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    type,
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.OPAQUE);
            lp.gravity = Gravity.CENTER;
            // Draw behind the status bar / cutout so the dark screen runs edge to
            // edge instead of leaving a tinted strip behind the clock.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                        ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                        : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                lp.setFitInsetsTypes(0);
            }
            wm.addView(view, lp);
            root = view;
            handler.post(tick);
        } catch (Throwable t) {
            root = null;
        }
    }

    void hide() {
        handler.removeCallbacksAndMessages(null);
        View v = root;
        root = null;
        if (v == null) return;
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm != null) wm.removeViewImmediate(v);
        } catch (Throwable ignored) {}
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (root == null) return;
            // Lift the cover automatically once the day rolls over.
            if (System.currentTimeMillis() >= endsAt) {
                hide();
                return;
            }
            long now = System.currentTimeMillis();
            root.setResetRemaining(endsAt - now);
            // Align to the next whole second so the countdown ticks evenly.
            handler.postDelayed(this, 1000L - (now % 1000L));
        }
    };
}
