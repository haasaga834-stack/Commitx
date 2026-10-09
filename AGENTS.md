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
- Check for the Android bridge at each Standard commitment confirmation and offer Focus Shield before themes; never cache a completed Shield step across retries, because backing out must not bypass the choice.
- Both native Focus Shield entry points use FocusShieldReminderView and dedicated Android color resources so the overlay and fallback screen remain visually consistent without changing website styles or blocking logic.
- Native running group sessions render GroupParticipantsDrawer after bridge detection; website sessions keep their existing participant summary, and both read the same group state without additional membership requests.
