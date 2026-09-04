package app.commitx.mobile;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import app.commitx.mobile.R;

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

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#F8F9F6"));
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        root.addView(text("\uD83D\uDEE1 Focus Shield Active", 22, "#2E7D32", true));
        root.addView(spacer(dp(14)));
        root.addView(text(label + " is blocked during your commitment.", 16, "#1F2937", false));
        root.addView(spacer(dp(22)));
        root.addView(text("Time remaining", 12, "#6B7280", false));
        remainingView = text(formatRemaining(), 40, "#2E7D32", true);
        root.addView(remainingView);
        root.addView(spacer(dp(28)));

        Button back = new Button(this);
        back.setAllCaps(false);
        back.setText("Back to CommitX");
        back.setTextColor(Color.WHITE);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#2E7D32"));
        bg.setCornerRadius(dp(28));
        back.setBackground(bg);
        back.setPadding(dp(24), dp(14), dp(24), dp(14));
        back.setOnClickListener(v -> {
            try {
                startActivity(new Intent(this, MainActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                                | Intent.FLAG_ACTIVITY_CLEAR_TOP));
            } catch (Throwable ignored) {}
            finish();
        });
        root.addView(back);

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

    private TextView text(String value, int sp, String color, boolean bold) {
        TextView tv = new TextView(this);
        tv.setText(value);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        tv.setTextColor(Color.parseColor(color));
        tv.setGravity(Gravity.CENTER);
        if (bold) tv.setTypeface(tv.getTypeface(), android.graphics.Typeface.BOLD);
        return tv;
    }

    private View spacer(int height) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, height));
        return v;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics());
    }
}
