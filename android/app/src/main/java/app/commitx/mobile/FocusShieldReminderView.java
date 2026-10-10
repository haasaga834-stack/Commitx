package app.commitx.mobile;

import android.content.Context;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Shared presentation only; each caller keeps its existing timer and return action. */
final class FocusShieldReminderView extends LinearLayout {
    final TextView remainingView;
    private final TextView appView;

    FocusShieldReminderView(Context context, String appLabel, String remaining,
                            View.OnClickListener onReturn) {
        super(context);
        setOrientation(VERTICAL);
        setBackgroundColor(color(R.color.shield_background));
        setPadding(dp(24), dp(48), dp(24), dp(32));

        TextView brand = text("COMMITX  /  FOCUS SHIELD", 11, R.color.shield_primary, true);
        addView(brand, fullWidth());

        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout content = new LinearLayout(context);
        content.setOrientation(VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(0, dp(24), 0, dp(24));

        TextView emblem = text("\uD83D\uDC40", 44, R.color.shield_foreground, false);
        GradientDrawable badge = new GradientDrawable();
        badge.setShape(GradientDrawable.OVAL);
        badge.setColor(color(R.color.shield_surface));
        emblem.setBackground(badge);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(dp(96), dp(96));
        badgeParams.gravity = Gravity.CENTER;
        content.addView(emblem, badgeParams);
        gap(content, 20);
        content.addView(text("Caught in 4K.", 30, R.color.shield_foreground, true), fullWidth());
        gap(content, 8);
        appView = text("", 14, R.color.shield_muted, false);
        setAppLabel(appLabel);
        content.addView(appView, fullWidth());
        gap(content, 26);
        remainingView = text(remaining, 46, R.color.shield_primary, true);
        remainingView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        content.addView(remainingView, fullWidth());
        scroll.addView(content, new ScrollView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        addView(scroll, new LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f));

        Button back = new Button(context);
        back.setAllCaps(false);
        back.setText("Back to CommitX  →");
        back.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        back.setTypeface(back.getTypeface(), Typeface.BOLD);
        back.setTextColor(color(R.color.shield_on_primary));
        GradientDrawable background = new GradientDrawable();
        background.setColor(color(R.color.shield_primary));
        background.setCornerRadius(dp(8));
        back.setBackground(background);
        back.setOnClickListener(onReturn);
        addView(back, new LayoutParams(LayoutParams.MATCH_PARENT, dp(56)));
    }

    void setAppLabel(String label) {
        appView.setText("Opening " + label + " already?");
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

    private LayoutParams fullWidth() {
        return new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
    }

    private void gap(LinearLayout parent, int size) {
        View gap = new View(getContext());
        parent.addView(gap, new LayoutParams(1, dp(size)));
    }

    private int color(int resource) { return getContext().getColor(resource); }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics());
    }
}