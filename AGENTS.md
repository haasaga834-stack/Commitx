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
- Check for the Android bridge at each Standard commitment confirmation and offer Focus Shield before themes; never cache a completed Shield step across retries, because backing out must not bypass the choice.
- Both native Focus Shield entry points use FocusShieldReminderView and dedicated Android color resources so the overlay and fallback screen remain visually consistent without changing website styles or blocking logic.
- Native running group sessions render GroupParticipantsDrawer after bridge detection; website sessions keep their existing participant summary, and both read the same group state without additional membership requests.
- Accountability/Roast notifications are decided by the native AccountabilityEngine (AlarmManager, one alarm slot, one notification id) fed by events from src/lib/accountability.ts; enforce the built-in tone in both layers rather than saved user preferences, while preserving the master notification switch and OS permissions, because closed-app delivery and legacy clients must follow the same policy.
- Personal, group and preview Growing Plant visuals share a presentation-only component driven by existing session progress, so device layouts and growth never alter session tracking.
- Verified lock-screen notifications use a persisted native foreground-service projection of the existing session timestamps; notification expiry never awards coins or finalizes a session, because verification and the server ledger remain authoritative.
