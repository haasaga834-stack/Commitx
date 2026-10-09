package app.commitx.mobile;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/**
 * CommitX's reminder shown on top of a blocked app while Focus Shield is on.
 *
 * This uses a "display over other apps" overlay window rather than launching an
 * activity, because Android 10+ blocks background activity starts on many
 * devices — which made the reminder silently never appear. The blocked app is
 * never modified, hidden or removed; the user is simply reminded.
 */
final class FocusShieldOverlay {
    private final Context ctx;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private View root;
    private TextView remainingView;
    private FocusShieldReminderView reminderView;
    private long endsAt;
    private String shownFor;
    private long returningToCommitXUntil;

    FocusShieldOverlay(Context ctx) {
        this.ctx = ctx;
    }

    boolean isShowing() {
        return root != null;
    }

    /** Shows (or updates) the reminder for the given blocked package. */
    void show(String blockedPackage, long endsAtMs) {
        if (System.currentTimeMillis() < returningToCommitXUntil) return;
        this.endsAt = endsAtMs;
        if (root != null) {
            if (!blockedPackage.equals(shownFor)) {
                shownFor = blockedPackage;
                if (reminderView != null) {
                    reminderView.setAppLabel(labelFor(blockedPackage));
                }
            }
            return;
        }
        shownFor = blockedPackage;
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return;

            FocusShieldReminderView view = new FocusShieldReminderView(ctx,
                    labelFor(blockedPackage), formatRemaining(), v -> {
                try {
                    // Launch while our overlay is still visible: Android permits
                    // this user-initiated activity start, but may reject it after
                    // the overlay is removed. Keep the shield from immediately
                    // covering the timer while Android switches foreground apps.
                    returningToCommitXUntil = System.currentTimeMillis() + 5000L;
                    ctx.startActivity(new Intent(ctx, MainActivity.class)
                            .setAction(Intent.ACTION_MAIN)
                            .addCategory(Intent.CATEGORY_LAUNCHER)
                            .putExtra(MainActivity.EXTRA_ROUTE, "/session")
                             .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP
                                     | Intent.FLAG_ACTIVITY_SINGLE_TOP
                                    | Intent.FLAG_ACTIVITY_NEW_TASK));
                    hide();
                } catch (Throwable ignored) {
                    returningToCommitXUntil = 0L;
                }
            });
            reminderView = view;
            remainingView = view.remainingView;

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

            wm.addView(view, lp);
            root = view;
            handler.post(tick);
        } catch (Throwable t) {
            root = null;
            // Last resort: the in-app reminder screen.
            FocusShieldActivity.show(ctx, blockedPackage, endsAtMs);
        }
    }

    void hide() {
        handler.removeCallbacksAndMessages(null);
        View v = root;
        root = null;
        remainingView = null;
        reminderView = null;
        shownFor = null;
        if (v == null) return;
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm != null) wm.removeViewImmediate(v);
        } catch (Throwable ignored) {}
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (root == null || remainingView == null) return;
            if (!FocusShieldStore.isActive(ctx)) {
                hide();
                return;
            }
            remainingView.setText(formatRemaining());
            handler.postDelayed(this, 1000L);
        }
    };

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
            PackageManager pm = ctx.getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (Throwable t) {
            return "This app";
        }
    }

}
