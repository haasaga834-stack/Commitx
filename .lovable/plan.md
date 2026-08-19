# Keep the APK inside the CommitX app after the domain change

## What's happening

The Android app is hardcoded to open `https://commitx.lovable.app/`. Now that `commitx.site` is the primary domain, that old address redirects to the new domain. The app treats only `lovable.app` / `lovable.dev` / sign-in provider addresses as "inside the app", so the redirect to `commitx.site` is treated as an external link and gets handed to the phone's browser — which is why tapping the icon opens the web version.

## The fix

1. Point the app's start address at the new primary domain (`https://commitx.site/`) so there is no redirect on launch at all.
2. Add `commitx.site` and `www.commitx.site` to the list of addresses that stay inside the app, keeping the old `lovable.app` addresses in the list as well so older installs and any leftover redirects also stay in-app.
3. Keep the existing sign-in provider addresses (Google, backend) untouched so Google Sign-In and password reset links keep working.
4. Update the small note in the Android readme that records the current host.

Nothing changes in the web app itself — this is purely the Android shell's launch address and its in-app link rules.

## Technical details

- `android/app/src/main/java/app/commitx/mobile/MainActivity.java`
  - `START_URL` -> `https://commitx.site/`.
  - `isCommitXUrl(Uri)` -> match host `commitx.site`, `www.commitx.site`, and `commitx.lovable.app` (so deep-link/route building and the page-finished checks accept both).
  - `isInAppUrl(Uri)` -> also allow `commitx.site` and any `*.commitx.site` host; existing entries stay.
- `android/README.md` -> current host line updated to `commitx.site`.
- No manifest change needed: the launcher has no browsable/deep-link intent filter, so nothing hands the URL off to the browser at startup.

## After approval

The APK must be rebuilt (existing installs keep pointing at the old address until they're updated), then verify on device: tapping the icon stays in the app, in-app navigation never opens Chrome, and Google Sign-In still returns to the app.
