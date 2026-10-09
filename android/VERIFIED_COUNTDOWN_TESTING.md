# Verified lock-screen countdown

## Implementation
- Dedicated non-exported `VerifiedCountdownService`, `specialUse` foreground-service type, and non-exported boundary-alarm receiver; no new permissions.
- Existing Verified session supplies goal, selected theme, focus timestamps, running/paused state and recovery-break boundaries. Website, Standard, group sessions and coin calculations are not changed.
- Uses elapsedRealtime deadlines, not JS decrement counters. API 24+ System UI chronometer keeps time while CommitX sleeps. On interactive screens the padded HH:MM:SS title updates every second; screen-on immediately refreshes it. API 23 uses the service-updated title.
- System chronometer formatting remains Android-owned (M:SS/H:MM:SS); the padded title is not repainted every second with the screen off. No CPU wake lock is held.
- Theme accent/icon and motivational message follow the selected session theme. Android controls the notification card background, fonts, truncation and lock-screen presentation.
- PRIVATE visibility and a generic public version hide goals/times when sensitive lock-screen content is disabled. No permission prompt or settings bypass is added. Denied notifications do not fail sessions.
- Existing app-leave/multi-window interruption immediately updates the notification. Existing JS completion/failure replaces it with an outcome and stops the service.
- Native expiry says “Time reached. Return to CommitX to verify your result.” It does not award coins or record completed sessions. Existing session finalization remains authoritative. Break boundaries pause the notification and wait for the existing YES action.
- One notification ID and one boundary alarm prevent duplicates. Existing exact-alarm access is used only if already granted. Without it, Doze may delay the expiry/break status replacement; the system clock still recalculates remaining time. No new exact-alarm prompt is added.
- No reboot-started foreground service. Pre-reboot/large wall-clock-change bases are discarded; app session restoration owns recovery. Force-stop/device power-off cannot guarantee updates.

## Verification performed here
- Timestamp projection tests and native Java clock assertions.
- Android Java syntax, XML parsing and generated resource references.
- Web preview compilation.

## Not verified here
- Full Android Gradle build/AAB: this workspace has no Android SDK/Gradle.
- Physical Android device: no attached device or adb is available. Do not claim physical-device success or production readiness based on syntax checks.

## Required physical-device test checklist
Use a newly built APK, not the already-installed older bridge. Test API 23 fallback, API 24+, API 33 notification permission, API 34–36 specialUse behavior, and an OEM battery-restricted phone.

1. Start Verified with each of the five themes; confirm study goal, message, accent and HH:MM:SS title; expanded notification includes all content.
2. Compare app/notification clock immediately and after 2, 10 and 30 minutes locked. Wake screen and compare with timestamp-derived remaining time.
3. Tap notification while locked and unlocked; verify the existing commitment opens, without WebView reload, duplicate session or false app-leave event.
4. Trigger Home/app switching, multi-window, picture-in-picture and emergency grace; confirm the existing interruption rules are preserved and no completion is falsely advertised.
5. Exercise the >2h halfway break, break expiry and unbounded YES confirmation. Notification must not count break time as study or restart focus by itself.
6. Complete/fail with app open and locked; verify service stops, notification is replaced, and only the existing session finalizer updates ledger/profile.
7. Deny POST_NOTIFICATIONS, disable the channel, disable CommitX notifications; confirm sessions keep working and no details are leaked.
8. Set lock-screen “hide sensitive content” and “don't show notifications”; verify generic/no content as Android permits.
9. Enter Doze with/without exact-alarm access; record status-replacement delay. No exact-alarm prompt should occur.
10. Kill process, remove task, force-stop, reboot and change device time; record OEM-specific limitations. No stale countdown may create a session reward.
11. Check one notification only, no repeated sound/vibration, no session-end controls, and no change to Standard, Focus Shield, groups, Cx Coins or leaderboard.

## Release requirement
Update the existing Play Console foreground-service special-use declaration to cover the user-started Verified countdown, including a demonstration video. This requires the owner's review; no production settings were changed.