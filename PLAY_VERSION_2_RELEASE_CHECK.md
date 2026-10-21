# CommitX version 2 release gate — 21 October 2026 UTC

## Verdict
Not an unconditional upload clearance. Source remains versionCode **2**, versionName **1.0.1**, package **app.commitx.mobile**, minSdk **24**, target/compile SDK **36**. No publication or Play Console settings were changed.

## Verified
- Lovable Cloud auth and database respond normally.
- All 50 browser-side tests (including two new redaction tests) pass when each file runs separately. Running all files together exposes shared Bun mock interference, not a reproduced production sync failure.
- New analytics redaction tests pass; no goals, identity fields, session URLs or raw exceptions are transmitted by the reporting module.
- Native pure-Java tests: 7 countdown assertions and 13 App Limits assertions pass.
- Signed-in Profile and Settings load; public privacy, terms and contact load without uncaught browser errors.
- Authenticated tests reject another cam room's reads/sends and attempts to invoke privileged account cleanup.
- Preview compiler reports build OK after fixes.

## Fixed during this audit
- Release builds fail if the original upload keystore/credentials are missing. No debug-signing fallback or automatic replacement upload key.
- CI supports a durable original-key backup in GitHub secrets, keeping the existing cache path for transition. Signing credentials are not literals or traced in logs.
- Camera/microphone grants require exact CommitX HTTPS origins; unsupported resource grants and cancelled/pending requests are handled.
- Native bridge removed from identity-provider navigation; CommitX-host checks use exact hosts.
- Blocking services stop safely if foreground promotion fails. Standard terminal notifications no longer retain a live countdown.
- Account application-data deletion is transactional, includes buddy pairs/requests/events/signaling and checks errors before deleting login credentials. Referral preservation cannot double-credit on a retry after successful cleanup.
- Buddy signaling now goes through pair-authorized send/read functions instead of a public broadcast. Media remains encrypted peer-to-peer, muted initially, with no text chat or recording. Signaling uses short-lived readable results and activity-driven cleanup; device IP/network metadata may pass through signaling/STUN.
- Cam stop/unmount invalidates pending camera acquisition and releases late media tracks.
- Privacy and terms now describe discovery/social visibility, app limits, native Verified rules, camera/mic, network signaling and conditional pseudonymous analytics accurately.

## Do NOT upload the existing local build files
The checked-in/generated APK metadata is **versionCode 1 / 1.0.0**. The existing AAB certificate identifies **Android Debug**, not the verified Play upload key. They are stale test outputs, not this release. Rebuild from the newest source with the original Play upload key.

## Required signing setup
In GitHub repository Settings → Secrets and variables → Actions, provide:
- `COMMITX_KEYSTORE_BASE64`: base64 contents of the **original** upload keystore (private; do not paste in chat).
- `COMMITX_KEYSTORE_PASSWORD`, `COMMITX_KEY_ALIAS`, `COMMITX_KEY_PASSWORD`: its existing credentials.

If the key is only in the old Actions cache, recover that exact key securely and back it up. A cache is not durable key storage. Do not generate a replacement unless Play approves an upload-key reset.

Compare the newly built AAB certificate against Play Console's **upload key certificate**, not the separate **app signing certificate**. Google native sign-in must also be configured for the Play app-signing certificate. The actual GitHub secrets, original key, Console certificates and new AAB were not available for comparison here.

## Play Console checklist (owner must complete)
1. Confirm highest previously uploaded code is 1; version 2 must be unused.
2. Publish the updated website/privacy policy before submission; app changes are served from commitx.site.
3. App access: supply working reviewer sign-in instructions/test account, including access to optional buddy features without needing your personal account.
4. Foreground-service special-use declarations: explain and demonstrate Focus Shield, App Limits and both countdown services. Do not claim Android can prevent force-stop/uninstall.
5. Update Data Safety for actual profile/photo/age/sex/education, session goals/history, identifiers/referral fingerprint, social sharing, network signaling and any active analytics provider. The earlier blanket advice that P2P means audio/video are automatically “not collected” was too broad: assess Google's end-to-end encryption exception; ephemeral off-device processing may still need disclosure. Profile photos ARE stored in account data. Signaling/network metadata is distinct from encrypted media.
6. Keep Ads answer consistent with the Android app's actual ad-free behavior; website ads are separate. Check target audience/content rating and all user-generated content obligations for discovery, profile photos, invitations and video, including reporting/blocking and child-safety requirements. Those Console choices and safety-operation processes are not verified here.
7. Submit a fresh signed version 2 AAB and review all Play validation/pre-launch results. Google approval cannot be guaranteed by a code audit.

## Required device tests before declaring release ready
- Install/update from Play over version 1 without uninstalling; verify account, history and coins remain.
- Native Google sign-in: success, cancel, retry, timeout; stays inside CommitX.
- Standard and Verified 2-hour sessions: screen off, background, airplane mode/reconnect, process kill, reboot; original remaining time restored, one result and one eligible reward. Force-stop restrictions apply until manual reopen.
- Verify selected-app blocking and automatic release at expiry; deny/revoke usage access, overlays and notification permissions; confirm emergency/unblocked apps work.
- App Limits: exhausted Instagram reopens, switching back, midnight reset and reboot; Android detection cannot promise zero visible delay.
- Two real paired phones: cam connect, mic muted by default/unmute, permission refusal, stop during permission dialog, buddy removal/disconnection. STUN-only calls may fail on some networks without TURN.
- Disposable account deletion with buddy/referral/history records: confirm data gone, login removed, other user's referral reward unchanged across retries. Not tested destructively on a real account here.
- Launch/Back, lock-screen privacy, widget updates, OEM battery restrictions and group settlement/Room Pot once-only payout on multiple devices.

## Remaining audit limits
No fresh full Android release build, physical device, Play Console access or upload certificate verification. Existing security scans report no findings but several are stale; not equivalent to a new comprehensive security clearance. Analytics is currently unconfigured/inactive; native Java crash capture is not established by the browser reporting module. Android Gradle Plugin 8.9.2/API 36 supported-toolchain alignment and full lint must be checked in the fresh build.