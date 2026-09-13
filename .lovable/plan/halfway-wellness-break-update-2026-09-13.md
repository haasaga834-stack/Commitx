# Halfway wellness break update

## Goal
Keep every existing session mode, timer, reward, failure, persistence, Focus Shield, and navigation behavior intact, while replacing the current recurring hourly break with one safe halfway break.

## Changes
- Apply no break to sessions of 120 minutes or less.
- For sessions longer than 120 minutes, schedule exactly one 5-minute break when focused time reaches half of the selected duration:
  - 150 minutes → 75 minutes
  - 180 minutes → 90 minutes
  - 240 minutes → 120 minutes
- Freeze the authoritative focus clock at the exact halfway boundary and persist that paused state so reloads or suspended devices cannot consume focus time.
- After five minutes, move to a persistent `Ready to focus back?` state with one `YES` action.
- Remove the current one-minute confirmation countdown and `recovery_timeout` failure path. Waiting 10, 20, or more minutes will remain safe and paused.
- Resume from the exact banked focus time only after `YES`, then prevent any second break in that session.

## Break safety
- Treat both the five-minute break and the waiting-for-YES state as an explicit session pause.
- Temporarily exempt those two break phases from leave/inactivity failure handling, including web Verified lifecycle checks, while keeping all Verified enforcement unchanged during focus time.
- Keep backend heartbeats and the active-session record alive during the pause; do not mark the session failed merely because the break lasts longer than five minutes.
- Restore the correct break or confirmation state after refresh/reopen from persisted timestamps.

## Experience
- Replace the current large break presentation with a compact, responsive card for phones and tablets.
- Add a small original pastel illustration of a student relaxing under a tree, built as lightweight inline artwork with subtle motion and reduced-motion support.
- During the timed break, show the illustration, clear pause messaging, the 5-minute countdown, and restrained progress.
- Afterward, show only `Ready to focus back?` and a prominent `YES` button; keep it visible until pressed.

## Notifications and copy
- At break start, use the existing notification channel and preference controls to show: `Break time — take 5 minutes 🌿`.
- At break end, show: `Your break is over. Ready to focus back?`.
- Preserve the current sound, vibration, live session notification, and cancellation behavior.
- Update commitment and study-tracker descriptions that still promise hourly breaks so they accurately describe one halfway break for sessions longer than two hours.

## Validation
- Type-check the app.
- Exercise 120-, 150-, 180-, and 240-minute timing boundaries with controlled timestamps.
- Verify the timer stays frozen throughout the break and indefinite confirmation wait, survives reload, resumes exactly on `YES`, and never schedules another break.
- Verify Standard and Verified focus behavior is unchanged outside the break, and inspect the compact card on phone and tablet sizes.
