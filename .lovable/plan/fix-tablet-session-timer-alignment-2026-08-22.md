# Fix tablet session timer alignment

## Goal
Keep the running-session hourglass perfectly stationary on tablets and place the countdown, subject, and committed amount directly beneath it on one shared center axis, without changing session behavior or the mobile layout.

## Changes
1. **Create a tablet-only fixed center stage**
   - Give the hourglass and timer-information stack one shared, explicitly sized tablet container centered against the full session viewport.
   - Isolate it from surrounding flex sizing and changing text widths so no countdown update can alter its horizontal position.
   - Keep the existing mobile composition unchanged below the tablet breakpoint.

2. **Lock the hourglass geometry**
   - Keep the outer hourglass box at a fixed width and height with no horizontal transform or layout-dependent animation.
   - Move the falling-grain animation to SVG/CSS animation that does not trigger React state updates every frame.
   - Preserve progress-driven top and bottom sand levels and smooth vertical sand flow.

3. **Center the full timer hierarchy**
   - Put countdown, `Study`, and `₹50 committed` in the same fixed-width centered column immediately below the hourglass.
   - Use stable tabular countdown digits and fixed timer dimensions.
   - Explicitly center each label and remove any inherited alignment or width behavior that can pull them left.

4. **Verify at tablet dimensions**
   - Test the active session at the current 834×702 tablet viewport and a larger tablet landscape viewport.
   - Compare element center coordinates across multiple countdown frames to confirm zero horizontal movement.
   - Confirm Standard and Verified session controls and timer logic remain unchanged.

## Technical scope
Only the presentation and animation implementation in the active session and hourglass components will change. Commitment timing, persistence, lifecycle enforcement, wallet deductions, session completion, and navigation will not be modified.
