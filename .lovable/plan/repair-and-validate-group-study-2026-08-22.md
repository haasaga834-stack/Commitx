# Repair and validate Group Study

## Goal
Make Group Study reliable across the full lifecycle and give every Group Study screen a purpose-built tablet layout, while preserving the existing phone UI.

## Functional repairs
- Make create and join atomic on the backend: validate the authenticated user, available demo balance, lobby status, duplicate membership, and the five-person limit in one trusted transaction.
- Reserve each participant’s commitment when they join/create so the same demo balance cannot fund overlapping commitments; return it only on successful completion and permanently deduct it on failure/early leave.
- Make starting idempotent and organizer-only, require at least two committed participants, reject already-ended groups, and use one authoritative server start/end window for every member.
- Prevent duplicate or conflicting individual/group sessions for the same user by integrating Group Study with the existing active-session lock.
- Move outcome validation to the backend: users cannot claim completion before the authoritative end time; early leave/failure is recorded once; expired sessions settle consistently even after refresh or app restart.
- Ensure canceling a lobby refunds/releases every reserved commitment and removes the active-session locks for all participants.
- Return actionable errors to the UI instead of silently swallowing create, cancel, start, and outcome failures.
- Keep polling resilient and immediately reconcile state after create, join, start, leave, cancel, and completion.

## Tablet-specific UI
- Build a dedicated `/group` tablet dashboard rather than widening the phone column:
  - left workspace for create controls,
  - right workspace for invite-code joining and active/waiting groups,
  - desktop-style centered confirmation dialog for invite terms.
- Refine the tablet waiting room with a responsive two-column grid, stable headers, participant capacity/status, and clear organizer controls in portrait and landscape.
- Refine the tablet live session with a fixed centered timer/hourglass composition, separate participant panel, centered goal/amount labels, and a tablet-sized leave dialog.
- Keep the existing compact mobile layouts below 768px and prevent overflow at 768×1024, 834×1112, and landscape tablet widths.
- Use accessible labels, disabled/loading states, and existing semantic design tokens throughout.

## Data and implementation details
- Add a database migration containing transaction-safe functions for create, join, start, settle/leave, and cancel; keep direct client writes blocked and grant execution only to authenticated users/service role.
- Add the minimum reservation/settlement fields needed to memberships and enforce valid state transitions in the database.
- Keep `*.functions.ts` as thin authenticated wrappers and move reusable runtime helpers into server-only modules.
- Split tablet presentation into focused components so route logic remains shared between mobile and tablet UIs.

## Validation
- Add focused tests for amount/duration bounds, duplicate joins, sixth-member rejection, insufficient balance, organizer-only start, two-member minimum, double-start idempotency, early-completion rejection, one-time settlement, cancellation refunds, and session-lock conflicts.
- Exercise the live authenticated flow in the preview: create → invite preview → join → lobby synchronization → start → timer synchronization → leave/fail or complete → reopen.
- Visually verify `/group`, waiting room, active session, ended state, and dialogs at phone, tablet portrait, and tablet landscape sizes.
- Check browser console/network errors and run the relevant test suite after implementation.
