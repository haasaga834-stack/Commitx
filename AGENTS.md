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

Subdirectories have their own AGENTS.md (see android/AGENTS.md) — read it before changing files there.

- Android Google auth uses one serialized native chooser/token exchange; no skip flags or browser detours, because they stranded Play users. Eagerly import its adapter on Auth so module downloads cannot stall before the timeout. Website OAuth stays independent.

- Buddy invites use native/browser sharing with clipboard fallback; never open messaging sites in WebView popups, which fail on custom schemes.

- Focus-session rewards and forfeits must be derived and recorded transactionally from the user's own session claim (live `active_sessions` row, or its unconsumed `session_claims_archive` copy), each claim consumed once, because client-submitted session claims are untrusted and late syncs must not be lost.
- Wallet balances are always recomputed from the ledger (`focus_sessions`, `referrals`, `coin_adjustments`) by database triggers; never write `coin_balance` incrementally from app code, because parallel writers caused drift and double credits.
- Screens show recorded server totals plus only not-yet-synced local sessions; sessions the server refuses are removed locally, because max()/local-first merging showed phantom time.
- Personal terminal outcomes must be durably queued under a stable session id before clearing the active ticket; one account-scoped serialized retry worker records them, because process termination and overlapping writers otherwise lose results.
- Restore matching elapsed tickets and reconcile the earliest unprocessed break before completion; only commitment setup creates a new start timestamp, because zero-time restoration previously restarted timers.
- Profile, analytics and Home derive statistics from the shared full recorded-history snapshot plus pending outcomes; avoid separate aggregate/pending snapshots, because responses racing acknowledgement can double-count or temporarily lose time.
- Group state is readable only while the caller has a current `committed` or `joined` membership, because leaving must revoke access immediately.
- Scope the native app visual theme through the Android-bridge body class; shared public website routes must retain their independent design.
- Native tablet Home uses a dedicated full-width presentation with locally scoped landing tokens and existing app-route actions; all other native screens retain their existing shells, because homepage styling must not change phones, public pages, or session behavior.
- Native phone Home scopes its presentation tokens and bottom-navigation styling to its own MobileShell class, so Home updates cannot restyle tablet Home, public pages or other app screens.
- Require Focus Shield before themes at each native Verified confirmation, with live permissions rechecked and installed-app defaults provided by native category metadata/browser URL-handler discovery plus known-package fallback and explicit default exclusions; Standard and website flows stay separate so setup cannot be skipped or bleed into unrelated modes.
- Native running group sessions render GroupParticipantsDrawer after bridge detection; website keeps its participant summary; both read the same group state.
- Accountability/Roast notifications enforce the built-in tone in both the web and native layers rather than saved user preferences, while preserving the master notification switch and OS permissions.
- Personal, group and preview Growing Plant visuals share a presentation-only component driven by existing session progress, so device layouts and growth never alter session tracking.
- Native launch releases its logo cover only after authentication settles on the destination and two paint frames; native first-time onboarding is a single welcome on idle Home, while website onboarding stays independent, to avoid startup flashes and interrupting restored sessions.
- Screen Time lives on its own /screen-time page fed by native ScreenTimeDetails (UsageStatsManager, on-device only), deep-linked from the persistent notification.
- Widget invitation status is account-backed with local/native mirrors, because onboarding and existing-user To-Do prompts must not repeat after reinstall.
- Study Buddy events (started/completed/failed) are emitted by database triggers on `active_sessions`/`focus_sessions`, and group Room Pot shares are paid once per completer as `coin_adjustments` (`group_pot:<group_id>`) inside group settlement, because client-reported outcomes are untrusted and wallets derive only from the ledger.
- Buddy discovery is opt-in via RPCs; cam is muted P2P with no chat; pair-authorized signaling RPCs revoke removed-buddy access.
- Account deletion cleans application data and preserves referrals transactionally before auth deletion, preventing social leftovers and duplicate retry credits.
- Analytics/crash reporting go only through src/lib/analytics.ts (PostHog, inert without token, no personal content), to keep events privacy-safe.
- Task focus associations are account- and session-id-scoped, retained until a recorded successful outcome and owner-scoped task write are acknowledged; checklist updates never change session settlement.
- First-completion incentives are once-only coin_adjustments from a focus_sessions trigger, never local wallet increments, so retries and parallel settlement cannot duplicate rewards.
