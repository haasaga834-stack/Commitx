# Roadmap

- [ ] Diagnose and repair session restart/progress persistence and synchronization races without UI changes.
- [ ] Verify repeated completion, offline/reconnect, restart, ledger totals and Android countdown regressions.

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
