# CommitX Android APK

This folder contains everything needed to wrap CommitX as a native Android app using a **Trusted Web Activity (TWA)**.

A TWA is the recommended way to publish a web app as an APK — it opens your live CommitX site in a full-screen Chrome shell that looks and feels like a native app.

## What was already done for you

1. **PWA manifest** — `public/manifest.json` with app name, icons, theme colors, and shortcuts.
2. **Service worker** — `public/sw.js` for offline caching.
3. **App icons** — generated in `public/icons/` for all Android sizes (72px–512px, including maskable versions).
4. **Head tags** — `src/routes/__root.tsx` links the manifest, icons, and registers the service worker.

## Build the APK locally

### 1. Install prerequisites

- **Node.js** 18+ — https://nodejs.org
- **Java JDK** 17+ — `brew install openjdk@17` (macOS) or download from Oracle/Adoptium.
- **Android SDK** — easiest via Android Studio: https://developer.android.com/studio
  - Install SDK Platform for Android 13+ and Android SDK Build-Tools.
  - Set environment variables:
    ```bash
    export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
    export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
    ```

### 2. Run the build script

From this `android/` folder:

```bash
bash build-apk.sh
```

This will:
- Install the Bubblewrap CLI globally.
- Generate the Android TWA project (`android/twa-app/`).
- Build a signed APK.

### 3. Find your APK

After the build finishes, the APK path is printed. It usually looks like:

```
android/twa-app/app-release-signed.apk
```

Install it on your phone with:

```bash
adb install app-release-signed.apk
```

## Update the host URL

If your published Lovable URL changes, edit `host` in `android/twa-manifest.json` and re-run `build-apk.sh`.

Current host: `commitx.lovable.app`
