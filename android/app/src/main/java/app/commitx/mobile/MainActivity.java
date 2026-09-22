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
    private volatile boolean splashHidden = false;
    private Dialog authDialog;
    private WebView authWebView;
    private SharedPreferences preferences;
    private volatile boolean verifiedModeActive = false;
    private volatile boolean sessionLockActive = false;
    private volatile boolean atRootScreen = true;
    private volatile String pendingOAuthCallback = null;


    private static final int REQUEST_FILE_CHOOSER = 8021;
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
        requestNotificationPermissionIfNeeded();
        ScreenTimeTracker.scheduleChecks(this);
        PlanStore.scheduleAll(this);
        MotivationStore.reconcile(this);
        CommitXNotifications.showTodos(this);




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
        });

        FrameLayout root = new FrameLayout(this);
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

        android.widget.ImageView logo = new android.widget.ImageView(this);
        logo.setImageResource(R.drawable.splash_logo);
        int size = Math.round(getResources().getDisplayMetrics().density * 108);
        column.addView(logo, new android.widget.LinearLayout.LayoutParams(size, size));

        android.widget.ProgressBar spinner = new android.widget.ProgressBar(this);
        spinner.setIndeterminate(true);
        android.widget.LinearLayout.LayoutParams spinnerParams =
                new android.widget.LinearLayout.LayoutParams(
                        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
                        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        spinnerParams.topMargin = Math.round(getResources().getDisplayMetrics().density * 28);
        column.addView(spinner, spinnerParams);

        FrameLayout.LayoutParams columnParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        columnParams.gravity = android.view.Gravity.CENTER;
        overlay.addView(column, columnParams);
        return overlay;
    }

    /** Fades the startup screen out once the web app reports it is interactive. */
    private void hideSplash() {
        if (splashHidden || splashOverlay == null) return;
        splashHidden = true;
        final View overlay = splashOverlay;
        overlay.animate().alpha(0f).setDuration(220).withEndAction(() -> {
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
        if (route != null && !route.trim().isEmpty() && webView != null && canReloadForRoute()) {
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
        triggerVerifiedFailure("android_user_leave");
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
            triggerVerifiedFailure("multi_window");
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (isInPictureInPictureMode) {
            triggerVerifiedFailure("split_screen");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        injectPendingFailureIfNeeded();
        PlanStore.scheduleAll(this);
        WellnessSoundStore.reconcile(this);
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
            moveTaskToBack(true);
            return;
        }

        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void triggerVerifiedFailure(String reason) {
        if (!verifiedModeActive) return;
        if (authDialog != null && authDialog.isShowing()) return;
        preferences.edit().putString(PENDING_REASON, reason).apply();
        injectVerifiedFailure(reason);
    }

    private boolean isCommitXUrl(Uri uri) {
        if (uri == null) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(java.util.Locale.ROOT);
        return "commitx.site".equals(host)
                || host.endsWith(".commitx.site")
                || "commitx.lovable.app".equals(host)
                || "commitx.lovable.dev".equals(host);
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
        /** The web layer reports that the first screen is painted and usable. */
        @JavascriptInterface
        public void appReady() {
            runOnUiThread(MainActivity.this::hideSplash);
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

        @JavascriptInterface
        public boolean canScheduleExactAlarms() {
            return PlanStore.canScheduleExact(MainActivity.this);
        }

        @JavascriptInterface
        public void requestExactAlarmAccess() {
            if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.S
                    || PlanStore.canScheduleExact(MainActivity.this)) return;
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                            Uri.parse("package:" + getPackageName())));
                } catch (Throwable ignored) {
                    openAppNotificationSettings();
                }
            });
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
        }

        /** Re-arms without duplicating; safe to call on every app start. */
        @JavascriptInterface
        public void reconcileMotivationNotifications() {
            MotivationStore.reconcile(MainActivity.this);
        }


        /* ----------------------- Study progress notification ----------------- */

        @JavascriptInterface
        public void showSessionProgress(String title, String text, int progress) {
            CommitXNotifications.showSession(MainActivity.this, title, text, progress);
        }

        @JavascriptInterface
        public void hideSessionProgress() {
            CommitXNotifications.cancelSession(MainActivity.this);
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
