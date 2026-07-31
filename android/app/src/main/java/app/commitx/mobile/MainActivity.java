package app.commitx.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String START_URL = "https://commitx.lovable.app/";
    private static final String PREFS = "commitx_verified_mode";
    private static final String PENDING_REASON = "pending_failure_reason";

    private WebView webView;
    private Dialog authDialog;
    private WebView authWebView;
    private SharedPreferences preferences;
    private volatile boolean verifiedModeActive = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);


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
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isInAppUrl(uri)) {
                    return false;
                }
                if (uri != null) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (isCommitXUrl(Uri.parse(url))) {
                    injectPendingFailureIfNeeded();
                }
            }
        });

        setContentView(webView);
        webView.loadUrl(START_URL);
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
        return "commitx.lovable.app".equals(host);
    }

    /** CommitX plus the identity providers used by sign-in stay inside the app. */
    private boolean isInAppUrl(Uri uri) {
        if (uri == null) return false;
        String host = uri.getHost();
        if (host == null) return false;
        return isCommitXUrl(uri)
                || host.endsWith("lovable.app")
                || host.endsWith("lovable.dev")
                || host.endsWith("supabase.co")
                || host.equals("accounts.google.com")
                || host.endsWith(".google.com")
                || host.endsWith("googleusercontent.com")
                || host.endsWith("gstatic.com");
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
        final String clientId = getString(R.string.google_web_client_id);
        if (clientId == null || clientId.trim().isEmpty()) {
            notifyGoogleSignInError("native_unavailable");
            return;
        }
        try {
            GetSignInWithGoogleOption option =
                    new GetSignInWithGoogleOption.Builder(clientId).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(option)
                    .build();
            CredentialManager credentialManager = CredentialManager.create(this);
            credentialManager.getCredentialAsync(
                    MainActivity.this,
                    request,
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
                            notifyGoogleSignInError(e.getClass().getSimpleName());
                        }
                    });
        } catch (Throwable t) {
            notifyGoogleSignInError("native_unavailable");
        }
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
        @JavascriptInterface
        public void setVerifiedModeActive(boolean active) {
            verifiedModeActive = active;
        }

        /** Called by the web app; true when native Google Sign-In can be used. */
        @JavascriptInterface
        public boolean hasNativeGoogleSignIn() {
            String id = getString(R.string.google_web_client_id);
            return id != null && !id.trim().isEmpty();
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
    }
}
