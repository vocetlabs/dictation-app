# LAT3 test report, run 1

PR: #375 at f42cd2a5
Result: PASS

| # | Check | Result | Notes |
| - | ----- | ------ | ----- |
| 1 | Gate | PASS | `scripts/gate.sh`: all checks passed. |
| 2 | On-device budget is 12 s, pinned by tests | PASS | `local_cleanup::TIMEOUT` = 12 s; new test `the_on_device_budget_is_twelve_seconds` asserts 12 s (fails at 4 s); `llama/tests.rs` asserts the local cleaner's `deadline()` equals `local_cleanup::TIMEOUT`, so the pipeline gets 12 s. |
| 3 | Cloud stays 3 s | PASS | `cleanup::TIMEOUT` = 3_000 ms, untouched; its existing test still passes. |
| 4 | Nothing else changed beyond docs | PASS | `git diff origin/main...`: `core/src/local_cleanup.rs` (constant, comment, one test), `ENGINEERING.md` (one line), `LAT3.md` (new). |
| 5 | Local-mode cleanup e2e in dictation-vm-2 | NONE EXISTS | `e2e_cleanup_*` use the cloud fake provider. `e2e_local_model` covers the on-device speech model (~1.3 GB download), not local cleanup, and the diff does not touch that path, so it was not run. |

Not covered: a real on-device cleanup running past 4 s but under 12 s (no e2e hook); the unit tests pin the constant and its wiring only.
