# CommitX Version 5 (1.0.4) release audit

## Confirmed repairs
- App Limits retains stopped-vs-paused lifecycle state per activity class, including multi-activity transitions, and clears stale foreground state after confirmed stops.
- Service recreation reconstructs available historical activity events rather than looking back only ten minutes.
- Screen Time and App Limits count cross-midnight carry-in, with hourly/daily slices clipped to the requested day. Historical carry-in is cached to avoid repeatedly scanning a week.
- Cold-start screen-time notifications and alarm receiver usage scans run off the UI thread. Bridge screen-time and limit-list reads use background-refreshed usage caches.
- Offline cached startup registers reconnect recovery without reloading an active timer.
- Screen Time/native app picker recover when the bridge becomes available after mounting.
- Planner tasks, plans and daily/weekly goal edits are durably queued per account, acknowledged serially, retained through restart, and protected from stale account pulls.
- Website onboarding completion is durably retried. Offline notice no longer covers the working screen.
- Production dependency advisories resolved; server-function CSRF protection added; signing-key logging removed from CI.

## Verification
- 75 web regressions pass, run separately with `bun run test` to prevent module-mock contamination. Production dependency scan reports no known advisories.
- 48 standalone native assertions cover limits, lifecycle retention, midnight carry-in, completion deadlines, countdown and motivation policy. CI now runs these before release compilation.
- Changed App Limits/Screen Time classes compile against Android SDK 36 with untouched integration classes stubbed. This is **not** a full signed APK/AAB compilation.
- Signed-in browser checks at 360 × 685: Planner, Profile, Analytics, Settings, Group, Screen Time and commitment setup load without redirects, horizontal overflow or page errors.
- Real-account offline task creation, checkbox completion and goal change survived reload and were acknowledged through the live cloud connection. Temporary task removed afterwards.
- All rendered content routes have their own metadata; `/privacy` redirects to `/privacy-policy`.

## Release gate: not cleared for Play production yet
1. Wait for GitHub's Version 5 workflow to pass and obtain `commitx-v1.0.4.apk` / `commitx-v1.0.4.aab` from `latest-build`.
2. Confirm original upload-signing certificate matches Play; no replacement/debug signing is permitted.
3. Install the APK on Realme 15T and at least one other phone. Test repeated first-run/cold-start sign-in and permission buttons.
4. Exhaust a one-minute Instagram limit, try repeated partial swipes/recents and activity transitions; verify blocked-app reopen and Back to CommitX work.
5. Test process recreation after prolonged foreground use and overnight midnight rollover. Activity-class tracking cannot distinguish multiple instances of the same class; actual device enforcement remains unverified.
6. Launch a previously warmed app in airplane mode, navigate local pages and complete a solo session; reconnect and confirm exactly one recorded outcome and reward.
7. Test locked/background notification expiry, reboot, permissions denied, widget toggles and Google Play rate/share paths.
8. Upload the AAB to an internal/closed test track first. Promote only after these physical checks pass.

## Suggested release notes
Improved app startup and offline recovery. Strengthened daily app-limit blocking and Screen Time accuracy. Fixed back navigation, permission recovery and offline planner syncing. Improved widget and notification reliability.

No physical Android device or original CI signing identity was available in this audit. First-ever offline install still needs an initial online download; force-stop/OS restrictions can prevent background enforcement.