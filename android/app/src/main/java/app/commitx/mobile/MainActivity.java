package app.commitx.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String START_URL = "https://commitx.site/";
    private static final String PREFS = "commitx_verified_mode";
    private static final String PENDING_REASON = "pending_failure_reason";
    static final String EXTRA_ROUTE = "commitx_route";
    /** Preference key holding the Web (server) OAuth client ID for native sign-in. */
    private static final String GOOGLE_CLIENT_ID = "google_web_client_id";
    /** The one and only Android OAuth redirect URI. Registered in the manifest. */
    static final String OAUTH_REDIRECT = "commitx://login-callback/";

    /** Live instance used by notification actions to reach the web layer. */
    private static volatile MainActivity current;

    private WebView webView;
    private View splashOverlay;
    private FrameLayout rootLayout;
    private View offlineOverlay;
    private String failedUrl;
    private android.net.ConnectivityManager.NetworkCallback offlineNetworkCallback;
    private volatile boolean splashHidden = false;
    private long lastBackAtHome = 0;
    private Dialog authDialog;
    private WebView authWebView;
    private SharedPreferences preferences;
    private volatile boolean verifiedModeActive = false;
    private volatile boolean sessionLockActive = false;
    private volatile boolean atRootScreen = true;
    private volatile boolean resumed = false;
    private volatile String pendingOAuthCallback = null;


    private static final int REQUEST_FILE_CHOOSER = 8021;
    private static final int REQUEST_MEDIA = 8022;
    private android.webkit.PermissionRequest pendingMediaRequest;
    private ValueCallback<Uri[]> fileChooserCallback;
    private Uri pendingCameraUri;

    /** Delivers the picked/captured photo back to the WebView file input. */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_FILE_CHOOSER) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK) {
            if (data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            } else if (data != null && data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                results = new Uri[]{data.getClipData().getItemAt(0).getUri()};
            } else if (pendingCameraUri != null) {
                results = new Uri[]{pendingCameraUri};
            }
        }
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(results);
            fileChooserCallback = null;
        }
        pendingCameraUri = null;
    }

    /**
     * Tablets (smallest width >= 600dp) rotate freely between portrait and
     * landscape; phones stay locked to portrait. Re-applied on configuration
     * changes so display/multi-window moves are re-evaluated.
     */
    private void applyOrientationPolicy() {
        boolean allowLandscape = getResources().getBoolean(R.bool.allow_landscape);
        int wanted = allowLandscape
                ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_USER
                : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        if (getRequestedOrientation() != wanted) {
            setRequestedOrientation(wanted);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState);
        applyOrientationPolicy();
        current = this;
        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        CommitXNotifications.ensureChannels(this);
        ScreenTimeTracker.scheduleChecks(this);
        CommitXNotifications.showScreenTimeDaily(this);
        PlanStore.scheduleAll(this);
        MotivationStore.reconcile(this);
        CommitXNotifications.showTodos(this);

        FocusShieldStore.preloadApps(this, true);




        getWindow().setStatusBarColor(Color.parseColor("#F8F9F6"));
        getWindow().setNavigationBarColor(Color.parseColor("#F8F9F6"));
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        );

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // Required so Google Sign-In opens inside the app instead of an external browser.
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        // Google rejects generic WebView user agents for sign-in; present a standard Chrome UA.
        settings.setUserAgentString(browserUserAgent(settings.getUserAgentString()));

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new CommitXAndroidBridge(), "CommitXAndroid");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                openAuthWindow(resultMsg);
                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                closeAuthWindow();
            }

            /** Study Buddy cam: grant camera/mic to CommitX pages only, after Android permission. */
            @Override
            public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                runOnUiThread(() -> {
                    Uri origin = request.getOrigin();
                    if (!isTrustedMediaOrigin(origin)) {
                        request.deny();
                        return;
                    }
                    java.util.List<String> needed = new java.util.ArrayList<>();
                    for (String r : request.getResources()) {
                        if (!android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)
                                && !android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                            request.deny();
                            return;
                        }
                        if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)
                                && checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            needed.add(android.Manifest.permission.CAMERA);
                        }
                        if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)
                                && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            needed.add(android.Manifest.permission.RECORD_AUDIO);
                        }
                    }
                    if (needed.isEmpty()) {
                        request.grant(request.getResources());
                    } else {
                        if (pendingMediaRequest != null) pendingMediaRequest.deny();
                        pendingMediaRequest = request;
                        requestPermissions(needed.toArray(new String[0]), REQUEST_MEDIA);
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(android.webkit.PermissionRequest request) {
                runOnUiThread(() -> { if (pendingMediaRequest == request) pendingMediaRequest = null; });
            }

            /** Enables <input type="file"> (profile photo) inside the WebView. */
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = callback;
                try {
                    Intent content = params.createIntent();
                    Intent chooser = Intent.createChooser(content, "Select a photo");
                    Intent capture = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    if (capture.resolveActivity(getPackageManager()) != null) {
                        pendingCameraUri = getContentResolver().insert(
                                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                                new ContentValues());
                        if (pendingCameraUri != null) {
                            capture.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
                            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{capture});
                        }
                    }
                    startActivityForResult(chooser, REQUEST_FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    fileChooserCallback = null;
                    pendingCameraUri = null;
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (isCommitXUrl(Uri.parse(url))) view.addJavascriptInterface(new CommitXAndroidBridge(), "CommitXAndroid");
                else view.removeJavascriptInterface("CommitXAndroid");
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(view, request == null ? null : request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(view, url == null ? null : Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (isCommitXUrl(Uri.parse(url))) {
                    injectPendingFailureIfNeeded();
                    flushPendingTodoToggles();
                    String callback = pendingOAuthCallback;
                    if (callback != null) deliverOAuthCallback(callback);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                if (request == null || !request.isForMainFrame()) return;
                failedUrl = request.getUrl() == null ? START_URL : request.getUrl().toString();
                // The native overlay covers the raw error page. Never navigate to
                // about:blank: that strips the app bridge and the reconnect reload
                // then renders the public website instead of the app.
                try { view.stopLoading(); } catch (Throwable ignored) {}
                showOfflineOverlay();
            }
        });

        FrameLayout root = new FrameLayout(this);
        rootLayout = root;
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        splashOverlay = buildSplashOverlay();
        root.addView(splashOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        webView.loadUrl(startUrlFor(getIntent()));
        // Safety net: never trap the user behind the splash if the signal is missed.
        webView.postDelayed(this::hideSplash, 12000);
        // A cold start from the OAuth deep link: replay it once the page is ready.
        pendingOAuthCallback = oauthCallbackFrom(getIntent());
    }

    /**
     * Branded startup screen drawn on top of the WebView so a cold start shows
     * the CommitX logo instead of an empty page while the app boots.
     */
    private View buildSplashOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.parseColor("#F8F9F6"));
        overlay.setClickable(true);

        android.widget.LinearLayout column = new android.widget.LinearLayout(this);
        column.setOrientation(android.widget.LinearLayout.VERTICAL);
        column.setGravity(android.view.Gravity.CENTER);

        float density = getResources().getDisplayMetrics().density;
        android.widget.ImageView logo = new android.widget.ImageView(this);
        logo.setImageResource(R.drawable.splash_logo);
        // Match the Android system splash icon size so the handoff has no jump.
        int size = Math.round(density * 160);
        column.addView(logo, new android.widget.LinearLayout.LayoutParams(size, size));

        android.widget.TextView name = new android.widget.TextView(this);
        name.setText("CommitX");
        name.setTextColor(Color.parseColor("#14201A"));
        name.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 26);
        name.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        name.setLetterSpacing(0.04f);
        name.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams nameParams = new android.widget.LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nameParams.topMargin = Math.round(density * 8);
        column.addView(name, nameParams);

        android.widget.TextView tagline = new android.widget.TextView(this);
        tagline.setText("Commit. Focus. Prove it.");
        tagline.setTextColor(Color.parseColor("#5E6B63"));
        tagline.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14);
        tagline.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams tagParams = new android.widget.LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tagParams.topMargin = Math.round(density * 4);
        column.addView(tagline, tagParams);

        // Gentle text reveal under a logo that stays perfectly still.
        name.setAlpha(0f);
        tagline.setAlpha(0f);
        name.setTranslationY(density * 6);
        tagline.setTranslationY(density * 6);
        name.animate().alpha(1f).translationY(0f).setStartDelay(120).setDuration(320).start();
        tagline.animate().alpha(1f).translationY(0f).setStartDelay(220).setDuration(320).start();

        FrameLayout.LayoutParams columnParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        columnParams.gravity = android.view.Gravity.CENTER;
        overlay.addView(column, columnParams);
        return overlay;
    }

    /** Branded native offline screen shown instead of the WebView error page. */
    private void showOfflineOverlay() {
        hideSplash();
        if (rootLayout == null) return;
        if (offlineOverlay == null) {
            float d = getResources().getDisplayMetrics().density;
            FrameLayout overlay = new FrameLayout(this);
            overlay.setBackgroundColor(Color.parseColor("#F3F6F1"));
            overlay.setClickable(true);
            android.widget.LinearLayout col = new android.widget.LinearLayout(this);
            col.setOrientation(android.widget.LinearLayout.VERTICAL);
            col.setGravity(android.view.Gravity.CENTER_HORIZONTAL);
            int pad = Math.round(32 * d);
            col.setPadding(pad, 0, pad, 0);

            android.widget.TextView emblem = new android.widget.TextView(this);
            emblem.setText("\uD83C\uDF31");
            emblem.setTextSize(44);
            emblem.setGravity(android.view.Gravity.CENTER);
            android.graphics.drawable.GradientDrawable circle = new android.graphics.drawable.GradientDrawable();
            circle.setShape(android.graphics.drawable.GradientDrawable.OVAL);
            circle.setColor(Color.parseColor("#DDEBE2"));
            emblem.setBackground(circle);
            int es = Math.round(112 * d);
            col.addView(emblem, new android.widget.LinearLayout.LayoutParams(es, es));

            android.widget.TextView title = new android.widget.TextView(this);
            title.setText("You're offline");
            title.setTextSize(24);
            title.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
            title.setTextColor(Color.parseColor("#1F2A24"));
            title.setGravity(android.view.Gravity.CENTER);
            android.widget.LinearLayout.LayoutParams tp = new android.widget.LinearLayout.LayoutParams(-2, -2);
            tp.topMargin = Math.round(28 * d);
            col.addView(title, tp);

            android.widget.TextView body = new android.widget.TextView(this);
            body.setText("Your focus is safe. CommitX will reconnect automatically when you're back online.");
            body.setTextSize(14);
            body.setLineSpacing(0, 1.25f);
            body.setTextColor(Color.parseColor("#66736B"));
            body.setGravity(android.view.Gravity.CENTER);
            android.widget.LinearLayout.LayoutParams bp = new android.widget.LinearLayout.LayoutParams(-2, -2);
            bp.topMargin = Math.round(10 * d);
            col.addView(body, bp);

            android.widget.TextView retry = new android.widget.TextView(this);
            retry.setText("Try again");
            retry.setTextSize(15);
            retry.setTextColor(Color.WHITE);
            retry.setGravity(android.view.Gravity.CENTER);
            retry.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
            android.graphics.drawable.GradientDrawable pill = new android.graphics.drawable.GradientDrawable();
            pill.setCornerRadius(28 * d);
            pill.setColor(Color.parseColor("#2F7D5B"));
            retry.setBackground(pill);
            retry.setOnClickListener(v -> retryAfterOffline());
            android.widget.LinearLayout.LayoutParams rp = new android.widget.LinearLayout.LayoutParams(Math.round(200 * d), Math.round(52 * d));
            rp.topMargin = Math.round(32 * d);
            col.addView(retry, rp);

            FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(-1, -2);
            cp.gravity = android.view.Gravity.CENTER;
            overlay.addView(col, cp);
            offlineOverlay = overlay;
        }
        if (offlineOverlay.getParent() == null) {
            rootLayout.addView(offlineOverlay, new FrameLayout.LayoutParams(-1, -1));
        }
        offlineOverlay.setVisibility(View.VISIBLE);
        watchForReconnect();
    }

    private void watchForReconnect() {
        if (offlineNetworkCallback != null) return;
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager)
                    getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;
            offlineNetworkCallback = new android.net.ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(android.net.Network network) {
                    // Give routing a moment to come up before reloading.
                    if (webView != null) webView.postDelayed(MainActivity.this::retryAfterOffline, 800);
                }
            };
            cm.registerDefaultNetworkCallback(offlineNetworkCallback);
        } catch (Throwable ignored) { offlineNetworkCallback = null; }
    }

    private void stopWatchingReconnect() {
        if (offlineNetworkCallback == null) return;
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager)
                    getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) cm.unregisterNetworkCallback(offlineNetworkCallback);
        } catch (Throwable ignored) {}
        offlineNetworkCallback = null;
    }

    private void retryAfterOffline() {
        if (offlineOverlay == null || offlineOverlay.getVisibility() != View.VISIBLE) return;
        if (webView == null) return;
        offlineOverlay.setVisibility(View.GONE);
        stopWatchingReconnect();
        String url = failedUrl == null ? START_URL : failedUrl;
        if (!isCommitXUrl(Uri.parse(url))) url = START_URL;
        // Re-attach before navigating so the app shell is detected on first render.
        webView.addJavascriptInterface(new CommitXAndroidBridge(), "CommitXAndroid");
        webView.clearHistory();
        webView.loadUrl(url);
    }

    /** Fades the startup screen out once the web app reports it is interactive. */
    private void hideSplash() {
        if (splashHidden || splashOverlay == null) return;
        splashHidden = true;
        final View overlay = splashOverlay;
        overlay.animate().alpha(0f).scaleX(1.04f).scaleY(1.04f).setDuration(260)
                .setInterpolator(new android.view.animation.DecelerateInterpolator()).withEndAction(() -> {
            overlay.setVisibility(View.GONE);
            ViewGroup parent = (ViewGroup) overlay.getParent();
            if (parent != null) parent.removeView(overlay);
        }).start();
    }


    /**
     * Keep every CommitX navigation in this activity, including redirects from
     * the former lovable.app host to the custom domain. Only genuinely external
     * web links are handed to another Android app.
     */
    private boolean handleNavigation(WebView view, Uri uri) {
        if (uri == null) return true;
        if (isInAppUrl(uri)) {
            if (!isCommitXUrl(uri)) view.removeJavascriptInterface("CommitXAndroid");
            // Returning false makes this WebView own the navigation. This also
            // covers server-side redirects and both WebView callback variants.
            return false;
        }
        String scheme = uri.getScheme();
        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Throwable ignored) {}
        }
        return true;
    }

    private String startUrlFor(Intent intent) {
        String route = intent == null ? null : intent.getStringExtra(EXTRA_ROUTE);
        if (route == null || route.trim().isEmpty()) return START_URL;
        return START_URL + route.replaceFirst("^/", "");
    }

    /**
     * A route intent reloads the web app from the network. With no connection
     * that would replace a perfectly good running timer with the WebView error
     * page, so in that case we simply bring the already-loaded page forward.
     */
    private boolean canReloadForRoute() {
        String current = webView == null ? null : webView.getUrl();
        boolean hasPage = current != null && current.startsWith(START_URL);
        if (!hasPage) return true;
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager)
                    getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            android.net.Network network = cm.getActiveNetwork();
            if (network == null) return false;
            android.net.NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null
                    && caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Throwable ignored) {
            return true;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String route = intent == null ? null : intent.getStringExtra(EXTRA_ROUTE);
        // A live session notification should only bring the existing timer to
        // the foreground. Reloading the WebView here destroys the mounted
        // Verified timer before its persisted ticket can be reconciled.
        boolean openingLiveSession = route != null
                && route.replaceFirst("^/", "").startsWith("session")
                && sessionLockActive;
        if (!openingLiveSession
                && route != null
                && !route.trim().isEmpty()
                && webView != null
                && canReloadForRoute()) {
            webView.loadUrl(startUrlFor(intent));
        }
        String callback = oauthCallbackFrom(intent);
        if (callback != null) deliverOAuthCallback(callback);
    }

    /** Returns the full commitx://login-callback/... URL carried by this intent. */
    private String oauthCallbackFrom(Intent intent) {
        if (intent == null) return null;
        Uri data = intent.getData();
        if (data == null) return null;
        if (!"commitx".equalsIgnoreCase(String.valueOf(data.getScheme()))) return null;
        return data.toString();
    }

    /**
     * Hands the OAuth callback URL to the web layer, which owns the Supabase
     * session exchange (the PKCE verifier lives in the WebView's storage).
     */
    private void deliverOAuthCallback(final String url) {
        pendingOAuthCallback = null;
        evalOnWeb("window.CommitXOAuth&&window.CommitXOAuth.onCallback&&"
                + "window.CommitXOAuth.onCallback(" + JSONObjectQuote(url) + ")");
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        stopWatchingReconnect();
        super.onDestroy();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT < 33) return;
        try {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 42);
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQUEST_MEDIA) {
            android.webkit.PermissionRequest req = pendingMediaRequest;
            pendingMediaRequest = null;
            if (req == null) return;
            boolean all = results != null && results.length > 0;
            if (results != null) for (int r : results) all &= r == android.content.pm.PackageManager.PERMISSION_GRANTED;
            if (all && isTrustedMediaOrigin(req.getOrigin())) req.grant(req.getResources()); else req.deny();
            return;
        }
        if (requestCode != 42) return;
        boolean granted = results != null && results.length > 0
                && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
        if (granted) {
            CommitXNotifications.ensureChannels(this);
            CommitXNotifications.showTodos(this);
        }
        evalOnWeb("window.CommitXNotifications&&window.CommitXNotifications.onPermissionResult&&"
                + "window.CommitXNotifications.onPermissionResult(" + granted + ")");
    }

    private boolean areNotificationsEnabled() {
        try {
            NotificationManager nm =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return false;
            if (android.os.Build.VERSION.SDK_INT >= 24 && !nm.areNotificationsEnabled()) return false;
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                return checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                        == android.content.pm.PackageManager.PERMISSION_GRANTED;
            }
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Opens this app's notification settings page (or app details as fallback). */
    private void openAppNotificationSettings() {
        try {
            Intent intent = new Intent("android.settings.APP_NOTIFICATION_SETTINGS")
                    .putExtra("android.provider.extra.APP_PACKAGE", getPackageName())
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Throwable t) {
            try {
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getPackageName()))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Throwable ignored) {}
        }
    }



    /** Pushes a notification-initiated toggle into the web layer. */
    static void notifyShieldAppsReady() {
        MainActivity activity = current;
        if (activity != null && activity.webView != null) activity.evalOnWeb("window.dispatchEvent(new Event('commitx:shield-apps-ready'))");
    }

    static void notifyWidgetChanged() {
        MainActivity activity = current;
        if (activity != null && activity.webView != null) activity.evalOnWeb("window.dispatchEvent(new Event('focus'))");
    }

    static boolean isViewingSession() {
        MainActivity activity = current;
        if (activity == null || !activity.resumed || activity.webView == null) return false;
        String url = activity.webView.getUrl();
        return url != null && "/session".equals(Uri.parse(url).getPath());
    }

    static void notifySessionDeadline() {
        MainActivity activity = current;
        if (activity != null) activity.evalOnWeb("window.dispatchEvent(new Event('focus'))");
    }

    static boolean notifyTodoToggled(String id) {
        MainActivity activity = current;
        if (activity == null || activity.webView == null) return false;
        activity.evalOnWeb("window.CommitXTodos&&window.CommitXTodos.toggleFromNative&&"
                + "window.CommitXTodos.toggleFromNative(" + activity.JSONObjectQuote(id) + ")");
        return true;
    }

    private void flushPendingTodoToggles() {
        String[] ids = TodoStore.drainPending(this);
        for (String id : ids) {
            if (id == null || id.isEmpty()) continue;
            evalOnWeb("window.CommitXTodos&&window.CommitXTodos.toggleFromNative&&"
                    + "window.CommitXTodos.toggleFromNative(" + JSONObjectQuote(id) + ")");
        }
    }


    private String browserUserAgent(String current) {
        if (current == null) return null;
        // Strip the "; wv" WebView marker that Google's sign-in flow blocks.
        return current.replace("; wv", "").replace("Version/4.0 ", "");
    }

    /** Hosts the Google / Lovable OAuth flow in an in-app WebView dialog. */
    @SuppressLint("SetJavaScriptEnabled")
    private void openAuthWindow(Message resultMsg) {
        closeAuthWindow();

        authWebView = new WebView(this);
        WebSettings s = authWebView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setUserAgentString(browserUserAgent(s.getUserAgentString()));
        CookieManager.getInstance().setAcceptThirdPartyCookies(authWebView, true);

        authWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // keep every hop of the OAuth flow inside the app
            }
        });
        authWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onCloseWindow(WebView window) {
                closeAuthWindow();
            }
        });

        FrameLayout container = new FrameLayout(this);
        container.addView(authWebView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        authDialog = new Dialog(this, android.R.style.Theme_Material_Light_NoActionBar);
        authDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        authDialog.setContentView(container);
        Window w = authDialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawable(new ColorDrawable(Color.parseColor("#F8F9F6")));
            w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        }
        authDialog.setOnDismissListener(d -> destroyAuthWebView());
        authDialog.show();

        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(authWebView);
        resultMsg.sendToTarget();
    }

    private void closeAuthWindow() {
        if (authDialog != null && authDialog.isShowing()) {
            authDialog.dismiss();
        }
        authDialog = null;
    }

    private void destroyAuthWebView() {
        if (authWebView != null) {
            authWebView.destroy();
            authWebView = null;
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Verified Mode allows app switching; Focus Shield blocks chosen apps.
        // (previously: triggerVerifiedFailure("android_user_leave");)
    }

    /**
     * Rotation is handled in-process (configChanges declares orientation), so the
     * WebView and the running session/timer survive rotation without a restart.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyOrientationPolicy();
    }

    @Override

    public void onMultiWindowModeChanged(boolean isInMultiWindowMode, Configuration newConfig) {
        super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig);
        if (isInMultiWindowMode) {
            // Verified Mode allows app switching; Focus Shield blocks chosen apps.
        // (previously: triggerVerifiedFailure("multi_window");)
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (isInPictureInPictureMode) {
            // Verified Mode allows app switching; Focus Shield blocks chosen apps.
        // (previously: triggerVerifiedFailure("split_screen");)
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        FocusShieldStore.preloadApps(this, true);
        injectPendingFailureIfNeeded();
        CommitXNotifications.showScreenTimeDaily(this);
        PlanStore.scheduleAll(this);
        WellnessSoundStore.reconcile(this);
        AppLimitsService.startIfNeeded(this);
    }

    @Override
    protected void onPause() {
        resumed = false;
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (authDialog != null && authDialog.isShowing()) {
            if (authWebView != null && authWebView.canGoBack()) {
                authWebView.goBack();
            } else {
                closeAuthWindow();
            }
            return;
        }
        // A commitment session is running: no system back action may leave the
        // session screen. The web layer shows the "Leave Session?" / "Warning"
        // dialog instead, and only its End Session button can finish it.
        if (sessionLockActive) {
            evalOnWeb("window.CommitXSession&&window.CommitXSession.onAndroidBack&&window.CommitXSession.onAndroidBack()");
            return;
        }

        // Home is the root destination: back must leave the app instead of
        // walking back into a previously visited section.
        if (atRootScreen) {
            long now = android.os.SystemClock.elapsedRealtime();
            if (now - lastBackAtHome < 2000) {
                lastBackAtHome = 0;
                moveTaskToBack(true);
            } else {
                lastBackAtHome = now;
                android.widget.Toast.makeText(this, "Press back again to exit", android.widget.Toast.LENGTH_SHORT).show();
            }
            return;
        }

        // Any other page: go to Home instead of closing the app.
        if (webView != null) {
            // An open dialog closes first; otherwise go Home. The web layer
            // reports the new root state itself once navigation settles.
            evalOnWeb("(function(){var n=window.CommitXNav;if(n&&n.closeTopModal&&n.closeTopModal())return;if(n&&n.goHome)n.goHome();else window.location.assign('/');})()");
            return;
        }
        super.onBackPressed();
    }

    private void triggerVerifiedFailure(String reason) {
        if (!verifiedModeActive) return;
        if (authDialog != null && authDialog.isShowing()) return;
        preferences.edit().putString(PENDING_REASON, reason).apply();
        VerifiedCountdownService.finish(this, "failed");
        injectVerifiedFailure(reason);
    }

    private boolean isTrustedMediaOrigin(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || (uri.getPort() != -1 && uri.getPort() != 443)) return false;
        String host = uri.getHost();
        return "commitx.site".equalsIgnoreCase(host) || "www.commitx.site".equalsIgnoreCase(host)
                || "commitx.lovable.app".equalsIgnoreCase(host)
                || "id-preview--1384a4d2-7b53-476d-badb-4dfc999cef26.lovable.app".equalsIgnoreCase(host);
    }

    private boolean isCommitXUrl(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(java.util.Locale.ROOT);
        return "commitx.site".equals(host)
                || "www.commitx.site".equals(host)
                || "commitx.lovable.app".equals(host)
                || "commitx.lovable.dev".equals(host)
                || "id-preview--1384a4d2-7b53-476d-badb-4dfc999cef26.lovable.app".equals(host);
    }

    /** CommitX plus the exact identity-provider hosts used by sign-in stay inside the app. */
    private boolean isInAppUrl(Uri uri) {
        if (uri == null) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(java.util.Locale.ROOT);
        return isCommitXUrl(uri)
                || host.equals("oauth.lovable.app")
                || host.equals("ldnjfjmwzqczjmewzdai.supabase.co")
                || host.equals("accounts.google.com")
                || host.endsWith(".google.com")
                || host.equals("googleusercontent.com")
                || host.endsWith(".googleusercontent.com")
                || host.equals("gstatic.com")
                || host.endsWith(".gstatic.com");
    }

    private void injectPendingFailureIfNeeded() {
        String reason = preferences.getString(PENDING_REASON, null);
        if (reason == null) return;
        injectVerifiedFailure(reason);
    }

    private void injectVerifiedFailure(String reason) {
        if (webView == null) return;
        final String safeReason = JSONObjectQuote(reason);
        runOnUiThread(() -> webView.evaluateJavascript(
                "(function(){" +
                        "var reason=" + safeReason + ";" +
                        "try{" +
                        "if(window.CommitXVerifiedMode&&window.CommitXVerifiedMode.fail){" +
                        "window.CommitXVerifiedMode.fail(reason);" +
                        "}else{" +
                        "var key='commitx-active-session-v1';" +
                        "var raw=localStorage.getItem(key);" +
                        "if(raw){var active=JSON.parse(raw);" +
                        "if(active&&active.mode==='verified'){" +
                        "active.pendingFail=true;active.reason=reason;active.failedAt=Date.now();" +
                        "localStorage.setItem(key,JSON.stringify(active));" +
                        "window.dispatchEvent(new CustomEvent('commitx:verified-pending-failure'));" +
                        "}}" +
                        "}" +
                        "}catch(e){}" +
                        "})();",
                value -> preferences.edit().remove(PENDING_REASON).apply()
        ));
    }

    private String JSONObjectQuote(String value) {
        if (value == null) return "\"android_user_leave\"";
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }


    /**
     * Native Google Sign-In through Credential Manager (Google Identity Services).
     * No external browser is opened. Requires a Web OAuth client ID supplied at build
     * time via the GOOGLE_WEB_CLIENT_ID environment variable, plus an Android OAuth
     * client registered with this app's package name and signing SHA-1.
     */
    private void startNativeGoogleSignIn() {
        // Stage 0: one-tap with accounts already authorized for CommitX.
        // Stage 1: chooser over every Google account on the device.
        // Stage 2: branded "Sign in with Google" sheet as a final fallback.
        requestGoogleCredential(0);
    }

    /**
     * Web (server) OAuth client ID. Baked in at build time when available, and
     * otherwise supplied by the web app at runtime via
     * CommitXAndroid.configureGoogleSignIn(clientId) — kept in prefs so later
     * launches can show the account chooser immediately.
     */
    private String googleWebClientId() {
        String runtime = preferences != null ? preferences.getString(GOOGLE_CLIENT_ID, "") : "";
        if (runtime != null && !runtime.trim().isEmpty()) return runtime.trim();
        String baked = getString(R.string.google_web_client_id);
        return baked == null ? "" : baked.trim();
    }

    private void requestGoogleCredential(final int stage) {
        final String clientId = googleWebClientId();
        if (clientId.isEmpty()) {
            notifyGoogleSignInError("native_unavailable");
            return;
        }

        try {
            GetCredentialRequest.Builder requestBuilder = new GetCredentialRequest.Builder();
            if (stage == 0) {
                requestBuilder.addCredentialOption(
                        new GetGoogleIdOption.Builder()
                                .setServerClientId(clientId)
                                .setFilterByAuthorizedAccounts(true)
                                .setAutoSelectEnabled(true)
                                .build());
            } else if (stage == 1) {
                requestBuilder.addCredentialOption(
                        new GetGoogleIdOption.Builder()
                                .setServerClientId(clientId)
                                .setFilterByAuthorizedAccounts(false)
                                .setAutoSelectEnabled(false)
                                .build());
            } else {
                requestBuilder.addCredentialOption(
                        new GetSignInWithGoogleOption.Builder(clientId).build());
            }

            CredentialManager credentialManager = CredentialManager.create(this);
            credentialManager.getCredentialAsync(
                    MainActivity.this,
                    requestBuilder.build(),
                    null,
                    Executors.newSingleThreadExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse response) {
                            try {
                                GoogleIdTokenCredential credential =
                                        GoogleIdTokenCredential.createFrom(
                                                response.getCredential().getData());
                                notifyGoogleIdToken(credential.getIdToken());
                            } catch (Throwable t) {
                                notifyGoogleSignInError("token_parse_failed");
                            }
                        }

                        @Override
                        public void onError(GetCredentialException e) {
                            // No matching credential (or the sheet couldn't be shown) —
                            // widen the request instead of forcing manual email entry.
                            if (stage < 2 && !isUserCancellation(e)) {
                                runOnUiThread(() -> requestGoogleCredential(stage + 1));
                                return;
                            }
                            notifyGoogleSignInError(e.getClass().getSimpleName());
                        }
                    });
        } catch (Throwable t) {
            if (stage < 2) {
                runOnUiThread(() -> requestGoogleCredential(stage + 1));
                return;
            }
            notifyGoogleSignInError("native_unavailable");
        }
    }

    private boolean isUserCancellation(GetCredentialException e) {
        return e instanceof androidx.credentials.exceptions.GetCredentialCancellationException;
    }


    private void notifyGoogleIdToken(final String idToken) {
        evalOnWeb("window.CommitXNativeAuth&&window.CommitXNativeAuth.onGoogleIdToken("
                + JSONObjectQuote(idToken) + ")");
    }

    private void notifyGoogleSignInError(final String reason) {
        evalOnWeb("window.CommitXNativeAuth&&window.CommitXNativeAuth.onGoogleSignInError("
                + JSONObjectQuote(reason) + ")");
    }

    private void evalOnWeb(final String js) {
        if (webView == null) return;
        runOnUiThread(() -> webView.evaluateJavascript("(function(){try{" + js + "}catch(e){}})();", null));
    }

    public class CommitXAndroidBridge {
        /** Uses Android's share sheet, never a messaging website in an OAuth popup. */
        @JavascriptInterface
        public void shareText(String title, String text) {
            if (text == null || text.trim().isEmpty()) return;
            runOnUiThread(() -> {
                try {
                    Intent send = new Intent(Intent.ACTION_SEND)
                            .setType("text/plain")
                            .putExtra(Intent.EXTRA_SUBJECT, title)
                            .putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, "Share invite"));
                } catch (Throwable ignored) {
                    android.content.ClipboardManager clipboard = (android.content.ClipboardManager)
                            getSystemService(Context.CLIPBOARD_SERVICE);
                    if (clipboard != null) {
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText(title, text));
                        android.widget.Toast.makeText(MainActivity.this, "Invite copied. Paste it into any chat.",
                                android.widget.Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        /** The web layer reports that the first screen is painted and usable. */
        @JavascriptInterface
        public void appReady() {
            runOnUiThread(() -> {
                if (splashHidden) return;
                hideSplash();
                // Let the first screen settle before displaying the existing OS prompt.
                if (webView != null) webView.postDelayed(() -> {
                    if (!isFinishing() && !isDestroyed()) requestNotificationPermissionIfNeeded();
                }, 600);
            });
        }

        @JavascriptInterface
        public void setVerifiedModeActive(boolean active) {
            verifiedModeActive = active;
        }


        /** Locks out hardware/gesture back navigation while a session is active. */
        @JavascriptInterface
        public void setSessionLockActive(boolean active) {
            sessionLockActive = active;
        }

        /** True while the Home (root) screen is showing. */
        @JavascriptInterface
        public void setAtRootScreen(boolean atRoot) {
            atRootScreen = atRoot;
        }

        /** Do Not Disturb state can be read on Android M and newer. */
        @JavascriptInterface
        public boolean canCheckDnd() {
            return android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M;
        }

        /** True when any Do Not Disturb / priority-only filter is active. */
        @JavascriptInterface
        public boolean isDndEnabled() {
            try {
                NotificationManager nm =
                        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return false;
                int filter = nm.getCurrentInterruptionFilter();
                return filter == NotificationManager.INTERRUPTION_FILTER_PRIORITY
                        || filter == NotificationManager.INTERRUPTION_FILTER_NONE
                        || filter == NotificationManager.INTERRUPTION_FILTER_ALARMS;
            } catch (Throwable t) {
                return false;
            }
        }

        @JavascriptInterface
        public void openDndSettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_ZEN_MODE_PRIORITY_SETTINGS));
                } catch (Throwable t) {
                    try {
                        startActivity(new Intent(Settings.ACTION_SOUND_SETTINGS));
                    } catch (Throwable ignored) {}
                }
            });
        }



        /** Called by the web app; true when native Google Sign-In can be used. */
        @JavascriptInterface
        public boolean hasNativeGoogleSignIn() {
            return !googleWebClientId().isEmpty();
        }

        /** Lets the web app supply the Web (server) OAuth client ID at runtime. */
        @JavascriptInterface
        public void configureGoogleSignIn(String clientId) {
            if (clientId == null || clientId.trim().isEmpty() || preferences == null) return;
            preferences.edit().putString(GOOGLE_CLIENT_ID, clientId.trim()).apply();
        }

        /** The redirect URI this build handles; the web app passes it to Supabase. */
        @JavascriptInterface
        public String oauthRedirectUri() {
            return OAUTH_REDIRECT;
        }

        /**
         * Opens a provider consent URL in the real browser. Google rejects
         * embedded WebViews, so this is the only supported browser-based path;
         * the browser returns to us through commitx://login-callback/.
         */
        @JavascriptInterface
        public boolean openExternalAuth(String url) {
            if (url == null || url.trim().isEmpty()) return false;
            final Uri target = Uri.parse(url.trim());
            // A Custom Tab stays on this task, so the commitx://login-callback/
            // redirect comes back into CommitX instead of stranding the user in
            // a detached browser window on the website.
            try {
                new CustomTabsIntent.Builder()
                        .setShowTitle(false)
                        .build()
                        .launchUrl(MainActivity.this, target);
                return true;
            } catch (Throwable ignored) {}
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, target);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return true;
            } catch (Throwable t) {
                return false;
            }
        }

        @JavascriptInterface
        public void googleSignIn() {
            runOnUiThread(MainActivity.this::startNativeGoogleSignIn);
        }

        @JavascriptInterface
        public void googleSignOut() {
            try {
                CredentialManager.create(MainActivity.this).clearCredentialStateAsync(
                        new ClearCredentialStateRequest(),
                        null,
                        Executors.newSingleThreadExecutor(),
                        new CredentialManagerCallback<Void, androidx.credentials.exceptions.ClearCredentialException>() {
                            @Override
                            public void onResult(Void unused) {}

                            @Override
                            public void onError(androidx.credentials.exceptions.ClearCredentialException e) {}
                        });
            } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public void clearPendingFailure() {
            preferences.edit().remove(PENDING_REASON).apply();
        }

        /* --------------------- Notification permission ----------------------- */

        @JavascriptInterface
        public boolean notificationsEnabled() {
            return areNotificationsEnabled();
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                CommitXNotifications.ensureChannels(MainActivity.this);
                if (android.os.Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 42);
                } else if (!areNotificationsEnabled()) {
                    openAppNotificationSettings();
                }
            });
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            runOnUiThread(MainActivity.this::openAppNotificationSettings);
        }

        /* ------------------------- To-do notification ------------------------ */


        /** items = JSON array of { id, text, done } for today. */
        @JavascriptInterface
        public void syncTodos(String itemsJson) {
            TodoStore.save(MainActivity.this, itemsJson);
            CommitXNotifications.showTodos(MainActivity.this);
        }

        @JavascriptInterface
        public void clearTodoNotification() {
            TodoStore.clear(MainActivity.this);
            CommitXNotifications.cancelTodos(MainActivity.this);
        }

        /* ----------------------- Study plan reminders ------------------------ */

        /** plans = JSON array of { id, subject, time, durationMinutes, repeat, weekday, monthday }. */
        @JavascriptInterface
        public void syncStudyPlans(String plansJson) {
            PlanStore.save(MainActivity.this, plansJson);
        }

        @JavascriptInterface
        public void setPlanRemindersEnabled(boolean on) {
            PlanStore.setEnabled(MainActivity.this, on);
        }


        /* ----------------------- Wellness break sounds ----------------------- */

        @JavascriptInterface
        public void scheduleWellnessSound(String eventKey, String kind, double fireAtMs) {
            WellnessSoundStore.schedule(MainActivity.this, eventKey, kind, (long) fireAtMs);
        }

        @JavascriptInterface
        public void playWellnessSound(String eventKey, String kind) {
            WellnessSoundStore.playNowOnce(MainActivity.this, eventKey, kind);
        }

        @JavascriptInterface
        public void cancelWellnessSounds(String sessionPrefix) {
            WellnessSoundStore.cancelPrefix(MainActivity.this, sessionPrefix);
        }

        /* ----------------------- Daily motivation ---------------------------- */

        /** Master toggle: arms or cancels the 8:00 AM / 7:00 PM motivation alarms. */
        @JavascriptInterface
        public void setMotivationNotifications(boolean on) {
            MotivationStore.setEnabled(MainActivity.this, on);
            if (on) AccountabilityEngine.reconcile(MainActivity.this);
            else { AccountabilityEngine.cancelAll(MainActivity.this); AccountabilityEngine.clearShown(MainActivity.this); }
        }

        /** Re-arms without duplicating; safe to call on every app start. */
        @JavascriptInterface
        public void reconcileMotivationNotifications() {
            MotivationStore.reconcile(MainActivity.this);
        }


        /* ----------------------- Accountability / Roast Mode ----------------- */

        @JavascriptInterface
        public void setAccountabilityStyle(String style) {
            AccountabilityEngine.setStyle(MainActivity.this, style);
        }

        @JavascriptInterface
        public void accountabilityDrafted(int targetMin) {
            AccountabilityEngine.onDrafted(MainActivity.this, targetMin);
        }

        @JavascriptInterface
        public void accountabilityStarted(int targetMin, double startedAtMs) {
            AccountabilityEngine.onStarted(MainActivity.this, targetMin, (long) startedAtMs);
        }

        @JavascriptInterface
        public void accountabilityEnded(String status, int targetMin, int doneMin, int streak, int failStreak) {
            AccountabilityEngine.onEnded(MainActivity.this, status, targetMin, doneMin, streak, failStreak);
        }

        @JavascriptInterface
        public void accountabilityAppOpened(int streak, int failStreak) {
            AccountabilityEngine.onAppOpened(MainActivity.this, streak, failStreak);
        }

        /* ----------------------- Study progress notification ----------------- */

        @JavascriptInterface
        public void showSessionProgress(String title, String text, int progress) {
            CommitXNotifications.showSession(MainActivity.this, title, text, progress);
        }

        @JavascriptInterface
        public void hideSessionProgress() {
            runOnUiThread(() -> {
                VerifiedCountdownService.clear(MainActivity.this);
                StandardCountdownService.clear(MainActivity.this);
                CommitXNotifications.cancelSession(MainActivity.this);
            });
        }

        @JavascriptInterface
        public void syncVerifiedCountdown(String payloadJson) {
            runOnUiThread(() -> VerifiedCountdownService.sync(MainActivity.this, payloadJson));
        }

        @JavascriptInterface
        public void syncStandardCountdown(String payloadJson) {
            runOnUiThread(() -> StandardCountdownService.sync(MainActivity.this, payloadJson));
        }

        @JavascriptInterface
        public void syncStudyWidget(String payloadJson) { StudyWidgetStore.sync(MainActivity.this, payloadJson); }

        @JavascriptInterface
        public boolean studyWidgetInvitationSeen(String userId) { return StudyWidgetStore.invited(MainActivity.this, userId); }

        @JavascriptInterface
        public void markStudyWidgetInvited(String userId) { StudyWidgetStore.markInvited(MainActivity.this, userId); }

        @JavascriptInterface
        public String pendingStudyWidgetTodos() { return StudyWidgetStore.pending(MainActivity.this).toString(); }

        @JavascriptInterface
        public void ackStudyWidgetTodos(String json) { StudyWidgetStore.ack(MainActivity.this, json); }

        @JavascriptInterface
        public boolean requestStudyWidget() {
            if (Build.VERSION.SDK_INT < 26) return false;
            android.appwidget.AppWidgetManager manager = android.appwidget.AppWidgetManager.getInstance(MainActivity.this);
            if (!manager.isRequestPinAppWidgetSupported()) return false;
            runOnUiThread(() -> manager.requestPinAppWidget(new android.content.ComponentName(MainActivity.this, StudyGoalWidget.class), null, null));
            return true;
        }

        @JavascriptInterface
        public void finishVerifiedCountdown(String status) {
            runOnUiThread(() -> VerifiedCountdownService.finish(MainActivity.this, status));
        }

        @JavascriptInterface
        public void finishStandardCountdown(String status) {
            runOnUiThread(() -> StandardCountdownService.finish(MainActivity.this, status));
        }

        /* ----------------------------- Screen time --------------------------- */

        @JavascriptInterface
        public boolean screenTimeSupported() {
            return ScreenTimeTracker.supported();
        }

        @JavascriptInterface
        public boolean hasUsageAccess() {
            return ScreenTimeTracker.hasPermission(MainActivity.this);
        }

        @JavascriptInterface
        public void openUsageAccessSettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Throwable t) {
                    try {
                        startActivity(new Intent(Settings.ACTION_SETTINGS));
                    } catch (Throwable ignored) {}
                }
            });
        }

        @JavascriptInterface
        public String screenTimeToday() {
            return ScreenTimeTracker.toJson(MainActivity.this);
        }

        @JavascriptInterface
        public String screenTimeDetails() {
            String json = ScreenTimeDetails.toJson(MainActivity.this);
            CommitXNotifications.showScreenTimeDaily(MainActivity.this);
            return json;
        }

        @JavascriptInterface
        public int screenTimeLimit() {
            return ScreenTimeTracker.limitMinutes(MainActivity.this);
        }

        @JavascriptInterface
        public void rateApp() {
            runOnUiThread(() -> {
                try {
                    com.google.android.play.core.review.ReviewManager manager =
                            com.google.android.play.core.review.ReviewManagerFactory.create(MainActivity.this);
                    manager.requestReviewFlow().addOnCompleteListener(task -> {
                        if (task.isSuccessful()) {
                            try {
                                manager.launchReviewFlow(MainActivity.this, task.getResult());
                                return;
                            } catch (Throwable ignored) {}
                        }
                        openPlayStoreListing();
                    });
                } catch (Throwable t) {
                    openPlayStoreListing();
                }
            });
        }

        @JavascriptInterface
        public void setScreenTimeLimit(int minutes) {
            ScreenTimeTracker.setLimitMinutes(MainActivity.this, minutes);
            ScreenTimeTracker.checkLimit(MainActivity.this);
        }

        /* ---------------------------- App limits ----------------------------- */

        @JavascriptInterface
        public boolean appLimitsSupported() {
            return FocusShieldStore.supported()
                    && FocusShieldStore.hasUsageAccess(MainActivity.this)
                    && FocusShieldStore.hasOverlayAccess(MainActivity.this);
        }

        @JavascriptInterface
        public String appLimitsJson() {
            return AppLimitsStore.toJson(MainActivity.this);
        }

        @JavascriptInterface
        public void setAppLimit(String pkg, String type, int minutes) {
            AppLimitsStore.setLimit(MainActivity.this, pkg, type, minutes);
            AppLimitsService.startIfNeeded(MainActivity.this);
        }

        @JavascriptInterface
        public void removeAppLimit(String pkg) {
            AppLimitsStore.removeLimit(MainActivity.this, pkg);
            if (!AppLimitsStore.hasLimits(MainActivity.this)) {
                AppLimitsService.stop(MainActivity.this);
            }
        }

        /* ---------------------------- Focus Shield --------------------------- */

        @JavascriptInterface
        public boolean focusShieldSupported() {
            return FocusShieldStore.supported();
        }

        @JavascriptInterface
        public boolean focusShieldHasUsageAccess() {
            return FocusShieldStore.hasUsageAccess(MainActivity.this);
        }

        @JavascriptInterface
        public boolean focusShieldHasOverlayAccess() {
            return FocusShieldStore.hasOverlayAccess(MainActivity.this);
        }

        @JavascriptInterface
        public void requestFocusShieldOverlayAccess() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + getPackageName()))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Throwable t) {
                    try {
                        startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    } catch (Throwable ignored) {}
                }
            });
        }

        @JavascriptInterface
        public String focusShieldApps() {
            return FocusShieldStore.installedAppsJson(MainActivity.this);
        }

        @JavascriptInterface
        public void preloadFocusShieldApps() { FocusShieldStore.preloadApps(MainActivity.this, false); }

        /** Returns true only when native protection is genuinely running. */
        @JavascriptInterface
        public boolean focusShieldStart(String packagesJson, double endsAtMs) {
            java.util.Set<String> packages = new java.util.LinkedHashSet<>();
            if (packagesJson != null) {
                for (String part : packagesJson.split("[\\[\\]\",\\s]+")) {
                    if (part != null && part.contains(".")) packages.add(part);
                }
            }
            if (packages.isEmpty()) return false;
            if (!FocusShieldStore.hasUsageAccess(MainActivity.this)
                    || !FocusShieldStore.hasOverlayAccess(MainActivity.this)) {
                return false;
            }
            FocusShieldStore.start(MainActivity.this, packages, (long) endsAtMs);
            FocusShieldService.start(MainActivity.this);
            return FocusShieldStore.isActive(MainActivity.this);
        }

        @JavascriptInterface
        public void focusShieldStop() {
            FocusShieldStore.stop(MainActivity.this);
            FocusShieldService.stop(MainActivity.this);
        }

        @JavascriptInterface
        public boolean focusShieldActive() {
            return FocusShieldStore.isActive(MainActivity.this);
        }
    }


    /** Play Store fallback when the in-app review flow is unavailable. */
    private void openPlayStoreListing() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Throwable t) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=" + getPackageName()))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Throwable ignored) {}
        }
    }
}
