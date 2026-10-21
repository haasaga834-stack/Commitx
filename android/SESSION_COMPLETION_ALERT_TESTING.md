# Deadline completion alerts

Personal Standard and Verified countdowns now emit a separate private, high-importance deadline alert from the native alarm/service. A persisted session timestamp marker prevents duplicate alerts after repeated receiver delivery or process restoration. Completion while the session page is visible is handled in the page without an external alert. Later verification/result recording must not issue another completion alert. Native expiry never records history or awards coins.

## Checked
- Nine pure Java deadline/foreground/replay assertions and seven clock assertions pass.
- Existing countdown, session recovery and accountability web tests pass.
- Countdown services, receivers and new alert helper compile against Android 16; unrelated application integrations are stubbed for this check, so this is not a full APK/AAB build.

## Physical phone release checks
Use a new Android build; website publishing alone cannot update the installed service.
1. Start a 30-minute Standard session, switch to another app, then lock the screen. At expiry, expect one timer-finished alert. Open it and expect the completion page; no new alert after returning.
2. Repeat with a Verified session and configured Focus Shield. Blocked apps should release at their existing deadline; the alert must not itself create rewards.
3. Complete while watching the session page: expect the result page with no external deadline alert.
4. Repeat with a two-hour session, task removal and process death (not force-stop). Compare expiry timing and reopen recovery, checking one recorded result and reward.
5. For sessions longer than two hours, verify the existing halfway break and explicit YES confirmation still pause focus; no completion alert during the break or confirmation wait.
6. Reopen several times after expiry; verify no repeated alert, result, or rewards. Test offline expiry and reconnect; existing durable recording must sync once.
7. Deny notifications/disable the channel or master notification switch: no notification; timer and result recovery should still work.
8. Test restricted battery mode, Doze, reboot and force-stop separately. Android may delay inexact alarms in Doze; force-stop prevents execution until launch, and powered-off devices cannot deliver alerts. Exact-alarm access is not newly requested or required by this change. Do not claim exact physical delivery without measuring these cases.

Group timers and website notification behavior are unchanged.