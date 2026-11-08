package app.commitx.mobile;

import android.content.Context;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Presentation-only block screen for App Limits. Uses the Focus Shield palette
 * but its own layout: status pill, the real app icon with a lock badge, the
 * saved limit, and a live countdown to the midnight reset. Blocking decisions
 * stay in AppLimitsService/AppLimitsOverlay.
 */
final class AppLimitsReminderView extends LinearLayout {
    private final TextView resetView;

    AppLimitsReminderView(Context context, String pkg, String appLabel, String limitSummary,
                          View.OnClickListener onReturn) {
        super(context);
        setOrientation(VERTICAL);
        setBackgroundColor(color(R.color.shield_background));
        setPadding(dp(24), dp(52), dp(24), dp(32));

        // Status pill pinned at the top.
        TextView pill = text("\uD83D\uDD12  COMMITX  \u2022  DAILY LIMIT REACHED", 11, R.color.shield_primary, true);
        pill.setLetterSpacing(0.08f);
        pill.setPadding(dp(14), dp(7), dp(14), dp(7));
        pill.setBackground(rounded(R.color.shield_surface, 999));
        LayoutParams pillParams = new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
        pillParams.gravity = Gravity.CENTER_HORIZONTAL;
        addView(pill, pillParams);

        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout content = new LinearLayout(context);
        content.setOrientation(VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);

        // Top-weighted rhythm: less space above than below so the block sits
        // in the upper-middle of tall screens instead of sinking low.
        spacer(content, 0.7f);

        content.addView(iconBadge(context, pkg), centered(dp(112), dp(112)));
        gap(content, 22);

        if (limitSummary != null && !limitSummary.isEmpty()) {
            TextView limit = text(limitSummary + " reached", 13, R.color.shield_roast, true);
            limit.setPadding(dp(14), dp(6), dp(14), dp(6));
            limit.setBackground(rounded(R.color.shield_surface, 999));
            content.addView(limit, centered(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT));
            gap(content, 18);
        }

        content.addView(text("Your limit. Your loophole?", 28, R.color.shield_foreground, true), fullWidth());
        gap(content, 8);
        content.addView(text(appLabel + ": you set it. Own it.", 15, R.color.shield_muted, false), fullWidth());
        gap(content, 30);

        LinearLayout reset = new LinearLayout(context);
        reset.setOrientation(VERTICAL);
        reset.setGravity(Gravity.CENTER_HORIZONTAL);
        reset.setPadding(dp(20), dp(16), dp(20), dp(18));
        reset.setBackground(rounded(R.color.shield_surface, 20));
        TextView resetLabel = text("\uD83C\uDF19  RESETS AT MIDNIGHT IN", 11, R.color.shield_muted, true);
        resetLabel.setLetterSpacing(0.1f);
        reset.addView(resetLabel, fullWidth());
        gap(reset, 6);
        resetView = text("", 32, R.color.shield_primary, true);
        resetView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        reset.addView(resetView, fullWidth());
        LayoutParams resetParams = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
        resetParams.leftMargin = dp(8);
        resetParams.rightMargin = dp(8);
        content.addView(reset, resetParams);

        spacer(content, 1f);

        scroll.addView(content, new ScrollView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        addView(scroll, new LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f));

        Button back = new Button(context);
        back.setAllCaps(false);
        back.setText("Back to CommitX  \u2192");
        back.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        back.setTypeface(back.getTypeface(), Typeface.BOLD);
        back.setTextColor(color(R.color.shield_on_primary));
        back.setBackground(rounded(R.color.shield_primary, 14));
        back.setOnClickListener(onReturn);
        addView(back, new LayoutParams(LayoutParams.MATCH_PARENT, dp(56)));
    }

    void setResetRemaining(long remainingMs) {
        resetView.setText(AppLimitsPolicy.formatResetIn(remainingMs));
    }

    private View iconBadge(Context context, String pkg) {
        FrameLayout frame = new FrameLayout(context);

        FrameLayout tile = new FrameLayout(context);
        tile.setBackground(rounded(R.color.shield_surface, 30));
        Drawable icon = null;
        try {
            icon = context.getPackageManager().getApplicationIcon(pkg);
        } catch (Throwable ignored) {}
        if (icon != null) {
            ImageView image = new ImageView(context);
            image.setImageDrawable(icon);
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setAlpha(0.55f);
            FrameLayout.LayoutParams ip = new FrameLayout.LayoutParams(dp(64), dp(64), Gravity.CENTER);
            tile.addView(image, ip);
        } else {
            TextView fallback = text("\uD83D\uDC40", 40, R.color.shield_foreground, false);
            tile.addView(fallback, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        }
        frame.addView(tile, new FrameLayout.LayoutParams(dp(100), dp(100), Gravity.TOP | Gravity.START));

        TextView lock = text("\uD83D\uDD12", 16, R.color.shield_on_primary, false);
        GradientDrawable lockBg = new GradientDrawable();
        lockBg.setShape(GradientDrawable.OVAL);
        lockBg.setColor(color(R.color.shield_primary));
        lockBg.setStroke(dp(3), color(R.color.shield_background));
        lock.setBackground(lockBg);
        frame.addView(lock, new FrameLayout.LayoutParams(dp(38), dp(38), Gravity.BOTTOM | Gravity.END));
        return frame;
    }

    private TextView text(String value, int size, int colorId, boolean bold) {
        TextView view = new TextView(getContext());
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, size);
        view.setTextColor(color(colorId));
        view.setGravity(Gravity.CENTER);
        view.setFontFeatureSettings("tnum");
        if (bold) view.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        return view;
    }

    private GradientDrawable rounded(int colorId, int radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color(colorId));
        d.setCornerRadius(dp(radiusDp));
        return d;
    }

    private LayoutParams fullWidth() {
        return new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
    }

    private LayoutParams centered(int w, int h) {
        LayoutParams p = new LayoutParams(w, h);
        p.gravity = Gravity.CENTER_HORIZONTAL;
        return p;
    }

    private void gap(LinearLayout parent, int size) {
        parent.addView(new View(getContext()), new LayoutParams(1, dp(size)));
    }

    private void spacer(LinearLayout parent, float weight) {
        parent.addView(new View(getContext()), new LayoutParams(1, 0, weight));
    }

    private int color(int resource) { return getContext().getColor(resource); }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics());
    }
}
