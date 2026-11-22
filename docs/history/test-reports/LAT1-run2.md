# MLAT1 test report, run 2

PR: #365 at 170adc44
Result: PASS

Re-check of run 1's failure only (the fix touched tests/e2e only).

| Scenario (dictation-vm-2) | Run 1 | Run 2 |
| --- | --- | --- |
| e2e_connect_openrouter | FAIL | PASS |
| e2e_onboarding_first_run | FAIL | PASS |
| e2e_settings_key_provider_recovery | FAIL | PASS |
| e2e_quit_during_transcription_then_relaunch | FAIL | PASS |
| e2e_cleanup_applied | PASS | PASS |
| e2e_cleanup_deadline | PASS | PASS |

6 passed, 0 failed, 0 skipped.

New assertions in e2e_cleanup_applied, all passing: the cleanup line carries
provider="FakeHost"; a keyless HEAD (`warm auth=none`) arrived at key-down;
no HEAD carried a key. The fake answers HEAD 200 unnumbered, so request
numbering is as before.

AC 1-4 and the gate were verified in run 1; the product code is unchanged
since. AC 5 is the Lead's manual rerun.
