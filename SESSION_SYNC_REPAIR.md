# Session synchronization repair

## Root causes reproduced or isolated
- Reopening a matching timer after its deadline discarded progress and initialized a fresh start. Browser reproduction showed 00:59 instead of completion.
- Completion cleared its ticket before durably saving an outcome; process termination during the network request could lose it. Late lifecycle persistence could also recreate the ticket after completion.
- Pulls used pre-request local snapshots, ignored account switches, and deduplicated by matching content rather than identity.
- Online request failures had no autonomous backoff retry; flush and debounce could overlap.
- Profile aggregates and pending IDs were read independently; history stopped at 1,000 rows.
- Wallet recomputation calculated before acquiring a shared user lock. Archived completion used current time rather than the trusted archive timestamp.
- Native countdown clear/sync used different dispatch ordering; reboot rebasing discarded passed break boundaries.

## Repairs
Stable durable terminal IDs, a serialized account-scoped retry worker, identity-only merging, latest-state/generation guards, full paginated recorded history, shared statistics, conditional claim release, guarded setup, earliest-boundary recovery, group fetch ordering and retained protection on settlement failure. Existing UI, website Verified failure rules and native app-switch allowance remain unchanged.

Database migrations serialize wallet recomputation and require archived claims to have survived to their completion boundary. Existing ledger data was not deleted or rewritten.

## Verified
- Real signed-in one-minute commitment completed while backend requests were blocked. The local outcome survived reload/reconnect and appeared in Profile: completed +1, focus minutes +1, no coin reward. Replaying the identical request produced one row.
- Real historical eligible two-hour completion returned its existing 50-coin reward on repeated recording; totals remained unchanged.
- Standard and Android-bridge-simulated Verified expired-ticket restoration reached Success and remained ended after reload.
- 29 automated web regressions passed (including four synchronization interleavings), plus seven pure Java countdown assertions.
- Database queries: no duplicate claim keys, wallet-ledger mismatches or leaderboard-total mismatches at check time.
- Preview build passed; no page runtime errors observed during signed-in completion checks.

## Not verified / limitations
- No connected Android device/emulator or full Android SDK build environment: physical lock/background/reboot, notification/service behavior and full APK/AAB compilation remain unverified.
- Android bridge simulation is not a physical Android test; Java clock assertions do not execute services.
- Group multi-device settlement and concurrent wallet writers were source-reviewed but not exercised with two live devices/database connections.
- Starting a commitment entirely offline still has no trusted server claim; it cannot securely generate server rewards. Existing offline progress behavior is preserved, not falsely certified as reward-capable.
- One explicit one-minute validation session was recorded on the requesting account and retained; no historical user data was removed.
- App publishing and Play Console uploads were not performed; native changes require a new Android build.