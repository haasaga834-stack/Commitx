# Roadmap

- [x] Complete both Android date/checklist widget layouts and remove obsolete ring code; XML and all 13 Java view references validated.
- [ ] Verify full APK/AAB compilation and installed launcher date/checklist appearance — requires Android SDK/JDK/Gradle (unavailable here), GitHub workflow and an updated phone install.
- [x] Remove phone Home Study Buddy card, bottom-align action cluster with 14px navigation gap, and add scoped dark mode; signed-in Settings toggle/reload/light restoration checked, three phone sizes and public website checked, nine rule tests pass.

- [ ] Finish Option A task Focus action, session attribution and success-only task completion; test roller and task rules.
- [x] Replace Android widget ring with editorial date and checklist, preserving Planner taps and checkbox sync; installed-device verification remains above.
- [x] Redesign native phone Home with original full-screen mountains, glass cards and subtle birds; preserve website/tablet and session logic.
- [ ] Add new-user 15-minute starter and secure once-only first-completion bonus; verify rules and user flow.

- [x] Add personal Standard/Verified deadline alerts with durable deduplication, foreground suppression and no late result/accountability alert on return; 9 new native policy assertions, 7 clock assertions, 9 web regressions and Android 16 service compilation passed. Existing reward/recovery paths unchanged.
- [ ] Verify completion alert at expiry while locked/away and result page on return on Android — requires a freshly built APK/AAB and physical device; exact delivery may be delayed by Android without exact-alarm access or after force-stop.

- [x] Final Play version 2 source audit: retained 2/1.0.1, fixed signing/privacy/social cleanup guards; 50 isolated browser tests, 20 native assertions and signed-in pages/authorization checks pass. Release gate recorded in PLAY_VERSION_2_RELEASE_CHECK.md; no publishing.
- [ ] Final version 2 upload clearance — blocked on original upload key/credential backup and certificate match, a fresh full Android release build, physical phone/multi-user checks, and owner Play Console declarations/reviewer/safety checks.

- [x] Remove the separately downloaded native sign-in module that can stall before its timeout starts; five lifecycle tests pass and simulated stuck chooser releases controls/retries natively without navigation. Timeout no longer falsely reports offline. Affected Play Store phone's successful login remains unverified.

- [x] Keep Android Google sign-in inside CommitX; removed stored browser fallback and overlapping timeouts. Simulated chooser cancellation/retry/provider failure opens no browser; lifecycle tests cover token exchange, duplicates and timeout. Real Play Store Google login remains unverified.
- [ ] Verify Play Store Google account chooser and successful in-app login on a physical phone — requires updated APK/AAB and a connected device.

- [x] Replace Study Buddy WhatsApp popup with native share sheet and website Web Share; older Android builds copy the invitation without leaving CommitX.
- [ ] Verify Android Study Buddy chooser-to-chat round trip on a physical phone — requires a new APK/AAB and connected device.

- [x] Reduce App Limits checks from 2 seconds to 300ms, move detection/usage work off the UI thread, share throttled usage aggregation, and remove the 5-second return-button bypass; 13 App Limits and 7 existing countdown assertions passed. Changed native classes compile against Android 36 with unchanged integrations stubbed; this is not a full release build or device check.
- [ ] Verify App Limits reopen latency, return navigation, daily reset and background behavior on a physical Android device — requires updated APK/AAB and an attached device.

- [ ] Reverify pending-session recording after earlier Cloud pause — backend now responds normally and signed-in Profile/Settings verified on October 21; pending completion readback still needs a controlled session test.

- [x] Diagnose and repair elapsed-ticket restarts, terminal persistence, late lifecycle writes, identical-session deduplication, stale pulls/account responses, missing retries and split statistics snapshots without UI changes.
- [x] Verify real account offline completion/reload and same-id replay against the database; historical hourly reward replay unchanged; 29 web regressions and 7 native countdown assertions passed. Database checks found no duplicate claims, wallet mismatches or leaderboard mismatches.
- [ ] Physical Android session/background/reboot and group multi-device checks — requires a connected device and a new APK; bridge simulation and pure Java tests are not device verification.

- [x] Update native Verified defaults: Telegram optional, detected installed browsers required by default; 14 regression tests passed and Android manifest validated.
- [ ] Verify browser detection and locked defaults on Android — requires a new APK and physical device; native compilation/device testing unavailable in this turn.

- [x] Fix APK/AAB release compilation failure (missing android.os.Build import in widget pinning); full Gradle assembleRelease and bundleRelease succeeded, both artifacts produced, 7 native countdown assertions passed. GitHub signing identity was not available locally; rerun the workflow for distributable signed files.

- [x] Add compact Android study-goal launcher widget and once-per-account invitation after daily-goal onboarding or existing users' first To-Do opening; signed-in invitation and real task completion/reload verified, platform limitations documented.
- [x] Keep Standard notification countdown running in background without changing Verified behavior or notification appearance.
- [x] Preload/cache Focus Shield installed apps for faster setup without changing blocking rules.
- [ ] Verify new widget pinning, background countdown and Shield speed on Android — requires updated install and physical device.

- [x] Update the public Home title, add /terms to the sitemap, and clarify Android app blocking on Verified Focus; browser verified titles, rendered blocking information and valid sitemap XML, with a clean preview build.

- [x] Replace Profile's divided statistics panel with separate compact rounded cards and add Male/Female/Prefer not to say selection in a small pop-up; statistics and existing profile saving preserved, preview compiles cleanly. Signed-in interaction check blocked by the sign-in gate.

- [x] Compact the Profile and Settings screens (identity card, three-column details, single dashboard panel, tighter leaderboard rows; settings quick tiles, grouped rows, tighter referral/account cards); all fields, stats, leaderboard rows and actions kept, checked signed-in at 360x685

- [x] Smooth native launch handoff and shorten native onboarding to one welcome; 11 tests passed, welcome dismissal checked in browser, Home/website/session UI preserved
- [ ] Verify updated native launch on a physical Android phone — requires an attached device and updated install

- [x] Center Focus Shield setup, remove native Verified skip paths, and default-select recognized social apps/games; four rule tests and simulated Android setup-to-theme flow passed
- [ ] Verify native app category detection and blocking on a physical Android phone — requires an attached device and updated install

- [x] Match phone Home to the supplied mint reference and use 30/60/90-minute Quick Commit options; phone appearance and links checked, tablet/website/session behavior preserved

- [x] Remove Accountability Style from Settings and enforce built-in Brutal for current and legacy users; bridge tests passed and Android syntax checked (device delivery requires an updated Android build)

- [ ] Add native Verified lock-screen countdown, theme accents, privacy-safe notification and lifecycle tests
- [ ] Physical Android lock/background/permission testing — requires an attached physical device

- [x] Update the shared Growing Plant theme to reference-based seed, sprout, leaves, flowers and fruit; growth tests passed and phone/tablet/desktop fit checked

- [x] Match the public homepage reference on Android tablets only; preserve phone home, other app pages, and Android package files (portrait/landscape, theme toggle, and session navigation checked)

- [x] Replace the native group participant card with a right-side drawer showing four rows before scrolling (opening, count, scrolling and closing verified in an isolated preview)

- [x] Redesign both native blocked-app reminders with playful roasts and a visible return-to-timer action (Java syntax and resources checked; appearance needs an updated Android install)

- [x] Lower the commitment header away from the Android status area
- [x] Always offer Focus Shield for each native Standard confirmation
- [x] Keep Focus Shield Continue visible while scrolling installed apps

- [x] Focus Class: remove history sentinel after session ends so Back never jams (verified: Back during class asks to confirm; after ending, Back leaves to Home)
- [x] Planner: remove AI planner section entirely (files deleted, no references left)
- [x] Planner: move Today's to-do card to the top (verified on signed-in Planner)
- [ ] (Later, if asked) AI plan hand-off: moot — AI planner removed
- [ ] Redesign only the signed-in CommitX app UI using the botanical reference; keep the public website and all functionality unchanged
- [x] Make native app light and dark modes visibly distinct while keeping website styling independent
- [x] Fix Focus Shield's Back to CommitX action so it returns to the running timer
- [x] Expand Focus Shield app selection beyond the currently listed apps
- [x] Fit the signed-in native app Home into one phone screen using the supplied visual reference; leave public website untouched
- [x] Make Verified session notification taps reopen the running session reliably
- [x] Audit session → coins → leaderboard → profile flow; make recorded sessions the single source of truth

- [x] minSdk 23 -> 24 (Play Console minimum requirement)

- [x] App Usage Limits: native store/service/overlay, 50%+100% alerts, midnight reset, Screen Time entry, optional onboarding step
