# Fix native study reminders and Wellness Break sounds

## Scope
Repair only the Android notification/reminder pipeline and the two Wellness Break sound cues. Preserve the existing Wellness Break UI, text, countdown, confirmation window, session rules, and all unrelated app behavior.

## Implementation

### 1. Make every planned-session reminder reliable
- Harden the native plan store so replacing the plan list first cancels alarms for removed or changed plans, then schedules exactly one upcoming reminder per current plan.
- Give each plan a stable, collision-safe native alarm identity instead of the current small hash buckets that can cause one plan to overwrite another.
- Keep recurrence calculations in the device’s local timezone and re-arm after boot, app update, manual clock changes, and timezone changes.
- Schedule the alarm for exactly 10 minutes before the occurrence with an exact-alarm capability check. Request Android’s “Alarms & reminders” access only when reminders need it; if Android withholds that access, use the safest available fallback rather than silently failing.
- Preserve the native plan mirror when the master Notifications toggle is off: cancel alarms while off, and re-arm the saved plans immediately when turned back on.
- Move study reminders to a versioned high-importance notification channel with an explicit default sound so devices that retained an older silent channel receive the corrected sound behavior.
- Keep subject, topic, “Starts at …”, duration, notification-bar display, tap destination, permission handling, and independent scheduling for every plan.

### 2. Add native one-shot Wellness Break sounds
- Add two short bundled Android sound assets: a calm break-start cue and a distinct return-to-study cue.
- Add a native sound scheduler/receiver that plays sound only—no notification, card, popup, message, or UI.
- From the existing authoritative session clock, arm the next break-start and break-end sound timestamps with a stable session/break event key. Persist consumed event keys so app restores, repeated ticks, lifecycle callbacks, and alarm reconciliation cannot replay a cue.
- On Android, use the native sound path exclusively; keep the current Web Audio behavior only as the web fallback so native and web sounds never overlap.
- Cancel pending Wellness Break sound alarms and release playback resources when the session completes, fails, is ended, or the component unmounts. Reconcile future events after a valid session restore without replaying elapsed events.
- Leave the existing `focus → recovery_break → awaiting_confirmation → focus/failure` state machine and all rendered Wellness Break content unchanged.

## Android and regression verification
- Build the release Android app and verify manifest/receiver compatibility with target SDK 36.
- Test create, edit-time, delete, multiple-plan, notification-toggle off/on, reboot, timezone-change, denied notification permission, and denied/granted exact-alarm access cases.
- Run an accelerated native alarm test for the full lifecycle: study reminder → session → break-start sound once → existing break countdown → return sound once → existing continuation flow.
- Repeat with the app foregrounded, minimized, and removed from recents; confirm no duplicate sounds or notifications and confirm ending the session cancels pending cues.
- Verify web behavior still falls back safely without Android bridge support and that no Wellness Break visual or functional regression is introduced.

## Expected files
- Android manifest and native plan reminder classes
- Android notification channel implementation
- New native Wellness sound receiver/store and two bundled sound resources
- Android bridge plus notification/sound TypeScript helpers
- Existing session route only for native scheduling/cancellation hooks; no JSX or styling changes
