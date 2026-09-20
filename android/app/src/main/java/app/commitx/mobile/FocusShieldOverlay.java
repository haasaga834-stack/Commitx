package app.commitx.mobile;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
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
    private TextView messageView;
    private long endsAt;
    private String shownFor;

    FocusShieldOverlay(Context ctx) {
        this.ctx = ctx;
    }

    boolean isShowing() {
        return root != null;
    }

    /** Shows (or updates) the reminder for the given blocked package. */
    void show(String blockedPackage, long endsAtMs) {
        this.endsAt = endsAtMs;
        if (root != null) {
            if (!blockedPackage.equals(shownFor)) {
                shownFor = blockedPackage;
                if (messageView != null) {
                    messageView.setText(labelFor(blockedPackage)
                            + " is blocked during your commitment.");
                }
            }
            return;
        }
        shownFor = blockedPackage;
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return;

            LinearLayout view = new LinearLayout(ctx);
            view.setOrientation(LinearLayout.VERTICAL);
            view.setGravity(Gravity.CENTER);
            view.setBackgroundColor(Color.parseColor("#F8F9F6"));
            int pad = dp(28);
            view.setPadding(pad, pad, pad, pad);

            view.addView(text("\uD83D\uDEE1 Focus Shield Active", 22, "#2E7D32", true));
            view.addView(spacer(dp(14)));
            messageView = text(labelFor(blockedPackage) + " is blocked during your commitment.",
                    16, "#1F2937", false);
            view.addView(messageView);
            view.addView(spacer(dp(22)));
            view.addView(text("Time remaining", 12, "#6B7280", false));
            remainingView = text(formatRemaining(), 40, "#2E7D32", true);
            view.addView(remainingView);
            view.addView(spacer(dp(28)));

            Button back = new Button(ctx);
            back.setAllCaps(false);
            back.setText("Back to CommitX");
            back.setTextColor(Color.WHITE);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(Color.parseColor("#2E7D32"));
            bg.setCornerRadius(dp(28));
            back.setBackground(bg);
            back.setPadding(dp(24), dp(14), dp(24), dp(14));
            back.setOnClickListener(v -> {
                hide();
                try {
                    // Same as the timer notification: open the live timer
                    // screen so the running session is restored, not reset.
                    ctx.startActivity(new Intent(ctx, MainActivity.class)
                            .setAction(Intent.ACTION_MAIN)
                            .addCategory(Intent.CATEGORY_LAUNCHER)
                            .putExtra(MainActivity.EXTRA_ROUTE, "/session")
                            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP
                                    | Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Throwable ignored) {}
            });
            view.addView(back);

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
        messageView = null;
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

    private TextView text(String value, int sp, String color, boolean bold) {
        TextView tv = new TextView(ctx);
        tv.setText(value);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        tv.setTextColor(Color.parseColor(color));
        tv.setGravity(Gravity.CENTER);
        if (bold) tv.setTypeface(tv.getTypeface(), Typeface.BOLD);
        return tv;
    }

    private View spacer(int height) {
        View v = new View(ctx);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, height));
        return v;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                ctx.getResources().getDisplayMetrics());
    }
}
