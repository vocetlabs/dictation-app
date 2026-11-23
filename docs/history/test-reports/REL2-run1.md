# REL2 test report, run 1

PR: #377 at 0e83d7b3
Result: PASS

| # | Check | Result | Notes |
| - | ----- | ------ | ----- |
| 1 | Gate, including `scripts/test-release.sh` | PASS | `scripts/gate.sh` all checks passed (after `npm ci`, the lockfile changed); `test-release.sh` ran in the gate and alone: ok. |
| 2 | DMG built as docs/releasing.md says, dev cert, not notarised, not uploaded | PASS | `RELEASE_IDENTITY="dictation-app Dev" RELEASE_NOTARY_PROFILE="" scripts/release.sh 0.2.0 --no-telemetry` (env override, no file edited, dry run): "signed dictation-app Dev, NOT notarised", the updater bundle and the DMG hold the same app, the `.sig` verifies against the public key and names 0.2.0. `scripts/check-dmg.sh` on the DMG: ok, version 0.2.0. |
| 3a | About / version 0.2.0 | PASS | `CFBundleShortVersionString` = 0.2.0; DMG, updater bundle and `latest.json` say 0.2.0. Version in `tauri.conf.json`, `package.json`, `Cargo.toml` all agree (the release script refuses otherwise). The About window itself was not opened. |
| 3b | `Contents/MacOS` has Vocet and llama-server | PASS | Both present. |
| 3c | Both signed, hardened runtime, entitlements | PASS | `codesign -dv --verbose=4`: Vocet `flags=0x10000(runtime)`, llama-server `flags=0x10000(runtime)`; bundle `codesign --verify --deep --strict` ok; entitlements: only `com.apple.security.device.audio-input`, as `Entitlements.plist`. Note llama-server carries the same audio-input entitlement. |
| 4 | Core e2e in dictation-vm-2 | PASS | 8 passed, 0 failed, 0 skipped: `e2e_release_build_smoke` (on this release .app: hardened runtime, mic entitlement, real hotkey, Settings draws), `e2e_cleanup_applied`, `e2e_hold_release`, `e2e_rapid`, `e2e_connect_openrouter`, `e2e_onboarding_first_run`, `e2e_update_keeps_permissions`, `e2e_local_model`. |

## Not covered
- A Developer ID signature, secure timestamp and notarisation: this build used the dev cert, so those need the owner's real release run (`release.sh` checks the timestamp for a Developer ID itself).
- The test-flag scenarios (cloud fake, onboarding, local model, update) need the debug build's test flags, which a release build ignores; they ran on this branch's debug build (version 0.2.0). Only `e2e_release_build_smoke` ran on the release .app.
