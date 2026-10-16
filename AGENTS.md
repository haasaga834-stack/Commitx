<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Focus-session rewards and forfeits must be derived and recorded transactionally from the user's own session claim (live `active_sessions` row, or its unconsumed `session_claims_archive` copy), each claim consumed once, because client-submitted session claims are untrusted and late syncs must not be lost.
- Wallet balances are always recomputed from the ledger (`focus_sessions`, `referrals`, `coin_adjustments`) by database triggers; never write `coin_balance` incrementally from app code, because parallel writers caused drift and double credits.
- Screens show recorded server totals plus only not-yet-synced local sessions; sessions the server refuses are removed locally, because max()/local-first merging showed phantom time.
- Group state is readable only while the caller has a current `committed` or `joined` membership, because leaving must revoke access immediately.
- Scope the native app visual theme through the Android-bridge body class; shared public website routes must retain their independent design.
- Native tablet Home uses a dedicated full-width presentation with locally scoped landing tokens and existing app-route actions; all other native screens retain their existing shells, because homepage styling must not change phones, public pages, or session behavior.
- Native phone Home scopes its presentation tokens and bottom-navigation styling to its own MobileShell class, so Home updates cannot restyle tablet Home, public pages or other app screens.
- Require Focus Shield before themes at each native Verified confirmation, with live permissions rechecked and installed-app defaults provided by native category metadata plus known-package fallback; Standard and website flows stay separate so setup cannot be skipped or bleed into unrelated modes.
- In the Android app, Verified sessions never fail on app switching/multi-window; enforcement is Focus Shield blocking (wall-clock expiry, restored on boot) plus locked back navigation, while the website keeps its strict leave-fails rules.
- Both native Focus Shield entry points use FocusShieldReminderView and dedicated Android color resources so the overlay and fallback screen remain visually consistent without changing website styles or blocking logic.
- Native running group sessions render GroupParticipantsDrawer after bridge detection; website sessions keep their existing participant summary, and both read the same group state without additional membership requests.
- Accountability/Roast notifications are decided by the native AccountabilityEngine (AlarmManager, one alarm slot, one notification id) fed by events from src/lib/accountability.ts; enforce the built-in tone in both layers rather than saved user preferences, while preserving the master notification switch and OS permissions, because closed-app delivery and legacy clients must follow the same policy.
- Personal, group and preview Growing Plant visuals share a presentation-only component driven by existing session progress, so device layouts and growth never alter session tracking.
- Verified lock-screen notifications use a persisted native foreground-service projection of the existing session timestamps; notification expiry never awards coins or finalizes a session, because verification and the server ledger remain authoritative.
- Native launch releases its logo cover only after authentication settles on the destination and two paint frames; native first-time onboarding is a single welcome on idle Home, while website onboarding stays independent, to avoid startup flashes and interrupting restored sessions.
- Screen Time lives on its own /screen-time page fed by native ScreenTimeDetails (UsageStatsManager, on-device only); a silent ongoing notification refreshed by the existing ScreenTimeReceiver alarm, boot and app resume deep-links there, because usage data must stay local and current without a foreground service.
- StudyGoalWidget uses account-scoped native presentation mirrors of existing focus sessions/goals/todos; checkbox desired states remain queued until owner-scoped cloud writes succeed, because launcher actions must survive offline use and midnight without creating rewards or crossing accounts.
- Widget invitation status is account-backed with local/native mirrors, because onboarding and existing-user To-Do prompts must not repeat after reinstall.
- Standard countdown uses a separate timestamp-projection foreground service and the existing notification builder, because WebView animation callbacks suspend in background and Verified behavior must remain untouched.
- Focus Shield package scans and icon encoding run on a cached single-thread worker preloaded at launch/resume, because synchronous bridge queries block setup painting.
- CI publishes the APK/AAB to a rolling `latest-build` GitHub Release (artifacts are optional, 1-day retention), because Actions artifact storage quota blocked downloads.
- App Usage Limits run in their own native store/service/overlay (AppLimitsStore, AppLimitsService, AppLimitsOverlay), separate from Focus Shield, because daily limits must not interfere with session blocking; reels limits are converted to minutes web-side (~30s each), usage resets naturally at local midnight, and 50%/100% alerts fire once per day per app.
