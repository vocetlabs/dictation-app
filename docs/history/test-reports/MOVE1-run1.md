# MOVE1 test report, run 1

PR: #357 at 7ef63fed
Result: PASS

The Developer's round-1 commit (7ef63fed) dropped the legacy owner path from the updater while I was testing f4eed2d9, so
everything below was re-run at 7ef63fed (URL checks were done at f4eed2d9; that commit changed no URLs).

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | `git grep gargankit90` (excluding docs/history) shows only deliberate leftovers | git grep | PASS | hits: `docs/ENGINEERING.md:72`, `docs/releasing.md:24` (both mention the archived old repo) and two `updater.rs` unit-test URLs that must be rejected |
| 2 | Every changed URL resolves | curl -sIL on 42 distinct URLs from the diff | PASS | live URLs 200 (old archive/latest redirect to vocetlabs); 404/000 only for deliberate test fixtures (fake tags, evil hosts, traversal), a `$VERSION` template, and v0.2.0 assets not yet published |
| 3 | Updater accepts only the vocetlabs release path | updater.rs unit tests; e2e_update_keeps_permissions, e2e_update_privileged_install (dictation-vm-2) | PASS | the old owner and `-releases` paths are rejected in tests |
| 4 | Settings key-provider recovery unaffected | e2e_settings_key_provider_recovery (dictation-vm-2) | PASS | |
| 5 | Help → About / Report a problem point at the new repo | diff review: `HelpAbout.tsx`, `report.rs` ISSUES_URL, tests in report.rs and commands.rs | PASS | verified from code and unit tests; the issues/new URL returns 200; no GUI click-through |

`e2e_update_to_new_certificate` does not exist in this tree; skipped.

## Gate
`scripts/gate.sh` passes at 7ef63fed (receipt written). Earlier runs at f4eed2d9 hit timing flakes under load (two
`dictation-transcribe` llama helper-start tests, two INT checks in `test-vm-lock.sh`); neither area is touched by the PR and
each passed on re-run. Hosted CI was pending when this was written.

## Untested behaviour found
None.

## Failures
None.
