# LAT4 test report, run 1

PR: #376 at 8a4abc77
Result: PASS

| # | Check | Result | Notes |
| - | ----- | ------ | ----- |
| 1 | Gate | PASS | `CARGO_BUILD_JOBS=4 nice -n 19 scripts/gate.sh`: all checks passed. |
| 2 | Unit tests pin 3 s for both paths | PASS | Cloud: `cleanup::TIMEOUT` = 3_000 ms, asserted in `core/src/cleanup.rs`. On-device: `llama/tests.rs` asserts `cleaner.deadline()` is `Some(3 s)` and equals `cleanup::TIMEOUT`; `src-tauri/src/cleanup/tests.rs` times the local fallback against `cleanup::TIMEOUT`. |
| 3 | No other 12 s / 4 s cleanup deadline remains | PASS | `local_cleanup::TIMEOUT` and its test are removed; grep for `local_cleanup::TIMEOUT`, `LAT3`, `from_secs(4|12)`, `12_000`, `twelve` in crates, src-tauri, src and docs finds none. The remaining 4 s hits are unrelated (`STOP_GRACE`, audio/clip fixtures). |
| 4 | Docs match | PASS | `ENGINEERING.md` says `cleanup::TIMEOUT` (3 s, same as cloud); doc comments in `cleanup.rs`, `llama.rs` and `src-tauri/src/cleanup.rs` point to the one constant. |
| 5 | Nothing else changed | PASS | Diff: `cleanup.rs` comment, `local_cleanup.rs` (constant, test and unused import removed), `llama.rs` (deadline), tests, one doc line, `LAT4.md`. |

No VM run, as asked.
