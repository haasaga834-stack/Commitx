# Fix Google Sign-In returning to the APK after the custom-domain switch

## What I verified

- The backend already accepts the app's deep link. A live probe of the auth endpoint with `redirect_to=commitx://login-callback/` returns a redirect to Google that carries that value through and uses the backend's own callback (`.../auth/v1/callback`) as Google's redirect URI. So the allow-list and the Google Cloud callback are correct, and the chain you asked for (Google -> backend callback -> `commitx://login-callback/`) is what the backend is set up to do.
- The Android shell still registers the `commitx://login-callback/` deep link and still forwards the callback URL into the web layer. The launch URL is `https://commitx.site/`, and `commitx.site`, `*.commitx.site` and the old `commitx.lovable.app` all stay in-app.
- The real gap: the APK never uses the in-app Google account chooser. It is enabled only when a Google Web client ID is baked in at build time (`GOOGLE_WEB_CLIENT_ID`), and nothing supplies it — no default value, no runtime call to the bridge method that would set it. So every APK sign-in falls into the browser round-trip, which is the path that ends up on the web app on the custom domain instead of coming back to the app.

## The fix

1. Bake the project's Google Web client ID into the Android build as a default, so the APK uses the device's native Google account chooser (one tap, no browser, no redirect at all). The build-time override stays supported. This client ID is the public one already visible in the sign-in URL — no secret goes into the APK.
2. Have the web layer also hand the client ID to the shell at startup through the existing bridge method, so already-built installs pick it up without a new APK where possible.
3. Keep the browser deep-link path as the fallback, and make it more reliable: open the consent URL in a Chrome Custom Tab (in-app browser tab) instead of a detached browser task, so the `commitx://login-callback/` redirect lands back in CommitX instead of leaving the user on the website. If a Custom Tab is unavailable, fall back to the current external-browser behaviour.
4. Leave the web app's Google sign-in, the custom domain, the site URL, the redirect allow-list, the package name and the SHA-1 completely untouched.

## Technical details

- `android/app/build.gradle`: `googleWebClientId` falls back to the known Web client ID constant when `GOOGLE_WEB_CLIENT_ID` is unset; add `androidx.browser:browser` for Custom Tabs.
- `android/app/src/main/java/app/commitx/mobile/MainActivity.java`: `openExternalAuth(url)` launches a `CustomTabsIntent` on this task first, then falls back to `ACTION_VIEW`. Deep-link receiver, `oauthRedirectUri()`, `hasNativeGoogleSignIn()`, `configureGoogleSignIn()` and the `commitx` intent filter stay as they are (single callback handler).
- `src/routes/auth.tsx` / `src/lib/native-auth.ts`: call `configureGoogleSignIn(<web client id>)` before the `hasNativeGoogleSignIn()` check so the native chooser is preferred; ordering of native -> browser -> web paths is unchanged.
- No changes to `src/lib/native-oauth.ts`'s `redirectTo` (`commitx://login-callback/`), to `public/sw.js` auth bypass, or to any backend configuration.

## What you need to do after

A new APK build is required — the account chooser and Custom Tab are native code. In Google Cloud, the Android OAuth client must exist for package `app.commitx.mobile` with SHA-1 `0A:62:78:01:48:8D:AA:DC:DB:85:3F:A9:E8:16:B8:1D:04:28:B2:39` (same client the native chooser validates against); the Web client keeps the backend callback URL it already has.
