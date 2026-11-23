# LAT2 test report, run 1

PR: #372 at 902b87fc
Result: PASS

| # | Check | Result | Notes |
| - | ----- | ------ | ----- |
| 1 | Cloud `cleanup::TIMEOUT` is 3 s | PASS | `crates/core/src/cleanup.rs`: 3_000 ms, pinned by the unit test. |
| 2 | Local budget unchanged | PASS | The diff touches no crate but `core/src/cleanup.rs`; the local cleaner still sets its own `deadline()`. |
| 3 | Docs match | PASS | `ENGINEERING.md`, `privacy.md`, e2e README and fake-provider comment say 3 s; no stale "1.5 s deadline" remains (other 1.5 s hits are unrelated hold times or LAT1 evidence comments). |
| 4 | Gate | PASS | `scripts/gate.sh`: all checks passed. |
| 5 | `e2e_cleanup_deadline` (dictation-vm-2) | PASS | Log: `cleanup outcome="fallback_timeout" duration_ms=3001`, inside the 2900-4500 ms bounds; the next dictation was cleaned. |
| 6 | `e2e_cleanup_applied` | PASS | `outcome="applied" duration_ms=6 provider="FakeHost"`. |

2 passed, 0 failed, 0 skipped.
