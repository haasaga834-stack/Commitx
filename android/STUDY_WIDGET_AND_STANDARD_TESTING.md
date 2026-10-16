# Study widget, Standard countdown and Shield checks

## Verified in this workspace
- 16 focused tests pass (onboarding invitation rules, three-task limit, account-scoped pending actions, timestamp countdown, existing Verified/Shield/launch regressions).
- Signed-in Planner: invitation opens, launcher pin request is dispatched through a simulated Android bridge, dismissal prevents repeats.
- A real task was created, marked done through the simulated widget bridge, persisted through the authenticated API, and read back in the UI after reload. Temporary tasks were removed.
- New widget/provider/store, Standard service/receiver, notification builder and Shield store compile against Android 36 with a stub Activity/resource class. This is not a full APK/AAB build.
- Resource XML parses and preview compilation passes.

## Requires an updated Android build and physical device
1. New account: confirm daily hours; see invitation before subject selection. Dismiss or request pin; finish onboarding. Relaunch and confirm no repeated daily-goal/widget invitation.
2. Existing account: open Planner; see invitation once. Verify same account on another install does not repeat it once the invitation flag has synchronized.
3. Pin widget using the launcher confirmation. On Android 7 or unsupported launchers, use the Widgets picker. Move/resize it; check wide and narrow layouts, three tasks, +more link, large study totals and day rollover.
4. Toggle a task while offline/app closed. Reopen online; confirm saved done state after another restart. Repeat around midnight and after account switching; no action should affect another account.
5. Complete an eligible focus session and confirm widget progress equals Home. Widget never awards coins or finalizes sessions itself.
6. Standard: start session; background, lock, swipe task away, reopen, reboot. Check real remaining time/progress and notification tap destination. Check cancel, existing pauses and halfway recovery/confirmation behavior.
7. Verified: confirm its service and blocking behavior are unchanged.
8. Focus Shield: measure cold and warm setup opening on a device with many apps. Install/remove an app, return to CommitX; verify list refresh and mandatory social/game defaults.
9. Check denied notifications and device battery restrictions. Force-stop can prevent services until reopening; no absolute closed-app delivery guarantee.

## Platform limitations
- The launcher owns final placement, cell size and confirmation. A default 4×2 widget is compact; a universal “30% of the screen” limit cannot be enforced.
- RemoteViews support a translucent glass surface but not a reliable blur of launcher wallpaper or arbitrary smooth animations. Ring/checklist update on recorded data changes; they are not WebView animations.
- Study minutes reflect completed sessions in the existing synchronized app mirror, not speculative active-session time. Cloud changes reach the widget when the app refreshes its mirror.
- Android's system chronometer keeps Standard time moving during CPU sleep; notification title/progress refresh on native ticks/screen wake. Battery restrictions/force-stop and notification permissions remain OS-controlled.
- Include the added Standard special-use foreground service purpose in the Play Console foreground-service declaration and supply a device demo. No Play release/version/signing configuration was changed.
