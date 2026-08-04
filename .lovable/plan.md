# Continuous Standard Timer, Scroll Duration Picker, and To-Do Lists

## 1. Standard mode timer keeps running

Today a Standard session pauses whenever the app is backgrounded or the screen turns off, and background time is not counted. Change it so the Standard timer runs continuously in real time:

- Remove the background pause/resume behaviour for Standard sessions (Verified mode rules stay exactly as they are: leaving the app fails the session, DND required, 60s grace).
- Elapsed time is computed purely from absolute timestamps, so closing/reopening the app or locking the screen shows the correct remaining time and can even complete while away.
- Drop the "Paused — background time isn't counted" chip for Standard mode.
- Back button/gesture interception and the "Leave Session?" dialog stay unchanged.

## 2. Duration picker in the study planner

Replace the numeric "Duration (min)" input in the New study session sheet with a vertical scroll (wheel-style) selector:

- Range 10 minutes to 6 hours, in 5-minute steps (10m, 15m … 6h).
- Snap-scrolling list with the selected value highlighted in the centre; labels read as "45 min", "1h 30m", "6h".
- Existing saved plans keep their duration; anything out of range is clamped.

## 3. Plus button offers two options

Tapping the + on the Planner opens a small chooser sheet:

- **Study plan** — the existing session form (subject, time, duration, repeat), unchanged criteria.
- **To-do list** — a simple free-text flow: type what you want to do today, add multiple items, tick them off, delete them.

To-dos are stored locally (same pattern as plans), scoped to today, and shown:

- On the Planner page, in a "Today's to-do" card under the goal card.
- On the active Session screen, as a compact checklist below the timer so the user can tick items while focusing.

Completed items show a strikethrough; the card shows an x/y done count. Items reset to a fresh list each day (previous day's list is discarded).

## Technical notes

- `src/lib/planner.ts`: add a `todos` store (`commitx-todos-v1`) with `useTodos()`, add/toggle/remove/prune-by-date helpers, and a duration option list generator (10..360 by 5).
- `src/routes/planner.tsx`: add a mode chooser sheet before the form, a `DurationWheel` component (scroll-snap + IntersectionObserver or scroll-position math), and the Today's to-do card.
- New `src/components/TodoList.tsx` shared by Planner and Session.
- `src/routes/session.tsx`: delete the Standard-mode visibility/blur pause effect and the paused chip; keep `pauseTimer` only for the DND-blocked Verified path.
