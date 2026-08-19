# CommitX Android APK

This folder contains everything needed to wrap CommitX as a native Android app using a **native WebView shell**.

CommitX uses a native Android shell so Verified Mode can receive Android lifecycle signals such as Home, Recent Apps, app switching, and split-screen/multi-window entry.

## What was already done for you

1. **Native lifecycle bridge** — `MainActivity` calls the web app when Android reports user-leave or multi-window events.
2. **PWA manifest** — `public/manifest.json` with app name, icons, theme colors, and shortcuts.
3. **Service worker** — `public/sw.js` for offline caching.
4. **Head tags** — `src/routes/__root.tsx` links the manifest, icons, and registers the service worker.

## Build the APK locally

### 1. Install prerequisites

- **Java JDK** 17+ — `brew install openjdk@17` (macOS) or download from Oracle/Adoptium.
- **Gradle** 8.10+ — https://gradle.org/install/
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

This generates a signing keystore if missing and builds a signed release APK, fully non-interactively (no Bubblewrap, no prompts).

### 3. Find your APK

After the build finishes, the APK path is printed. It usually looks like:

```
android/app/build/outputs/apk/release/app-release.apk
```

Install it on your phone with:

```bash
adb install app-release-signed.apk
```

## Update the host URL

If your published Lovable URL changes, edit `START_URL` in `android/app/src/main/java/app/commitx/mobile/MainActivity.java` and re-run `build-apk.sh`.

Current host: `commitx.site`
