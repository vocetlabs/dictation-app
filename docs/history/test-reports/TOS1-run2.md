# MTOS1 test report, run 2

PR: #352 at 4a2bec8
Result: PASS

Run 1's FAIL (setup stays behind System Settings after a grant) is fixed and proven in the VM. Everything else re-checked passes.

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 8 | Permission brings setup to the front (run 1 FAIL) | `e2e_setup_front_after_grant` (dictation-vm) | PASS | Microphone reset, setup at 680 by 520 under a full-size System Settings, macOS prompt answered Allow. Sampler: `System Settings` in front, then `Vocet` in front with System Settings still running. The after-screenshot shows "Set up Vocet" over System Settings with Microphone and Accessibility Allowed. |
| 8b | Accessibility grant through System Settings | not run | NOT TESTED | The Accessibility switch needs the password typed over VNC; not scripted in the time box. Same `take_grant` path as Microphone (Developer's note); `e2e_setup_no_permissions` and `e2e_accessibility_revoked` pass. |
| F1 | Flaky `e2e_onboarding_four_steps`, `e2e_connect_openrouter` | each run 3 times in a row, plus once in the full run | PASS | 3/3 passes each, and both passed again in the full run (no flake). |
| U1 | Terms line under the demo, Welcome | `e2e_onboarding_first_run`, Vitest | PASS | Passes in the e2e; not inspected pixel by pixel. |
| U2 | Speech pros/cons cards | `onboarding-2-speech-local-light.png` | PASS | Two cards, four short points each, only number is 4.4 GB, no price or speed figures; no scrolling at 680 by 520 (as screenshotted). |
| U3 | Connected state | `onboarding-connect-connected-light.png` | PASS | "✓ Connected to OpenRouter", "$4.82 left", Add credits, Continue; no key hint, no paste link. Balance is from the fake provider; real OpenRouter `/credits` (management key) is unverified, as the Developer says. |
| U4 | Settings sheet, both states | `onboarding-sheet-connected-light.png`, `onboarding-sheet-not-connected-light.png`, `e2e_settings_key_provider_recovery` | PASS | Connected: tick, balance, "Key ending 7a1c", Add credits, Disconnect, Done. Download button says 4.4 GB. Dark mode screenshots not viewed by me. |
| U5 | Tray download % | unit tests only | NOT TESTED in the VM | Needs a real download; `e2e_local_model` not run. |
| U6 | No price | `grep` of `site src crates` for "per 1,000" / "$0.70": none | PASS | |
| U7 | terms.html Gemma licence | read `site/terms.html` line 578: "OrukQwen and Gemma are both under Apache-2.0" | PASS | Matches the catalogue (run 1's minor is resolved). |

## Gate
Not re-run by me; CI and the Developer's pre-push hook ran it on 4a2bec8.

## E2E (dictation-vm)
Full run on 4a2bec8, `--exclude e2e_real_openrouter --exclude e2e_real_mic --exclude e2e_local_model`: 43 passed, 1 failed, 1 skipped.
- The one failure, `e2e_dmg_install`, used a **stale DMG** (built 11:25, before round 3) because I ran with `--no-build`; the old build has no "Having trouble?" fallback. Re-run on its own with a fresh DMG (runner built it): PASS. So 44 of 44 run scenarios pass.
- Skipped: `e2e_release_build_smoke` (optional).
- Not run: `e2e_local_model` (real 4.4 GB download does not fit the time box; it did not finish in run 1 either), `e2e_real_openrouter`, `e2e_real_mic`.

## Untested behaviour found
- Accessibility grant bringing setup to the front (see 8b); tray percentage in a real download; Settings → Privacy off-switch (unit tests only).
- The VM image has permissions pre-granted, so the owner should confirm on a real Mac that setup now comes forward after granting (the VM scenario reproduces the hidden-window case that failed there).

## Failures
None. Note: `--no-build` runs of `e2e_dmg_install` need a fresh DMG, or they fail on stale UI.
