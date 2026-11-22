# LAT1b test report, run 1

PR: #370 at 8c34cff7
Result: PASS

| # | Check | Result | Notes |
| - | ----- | ------ | ----- |
| 1 | Only the order constant, its comment, the pinned tests and the LAT1b note changed | PASS | `git diff origin/main...`: 4 files (`cloud_models.rs`, `transcribe/src/cleanup.rs`, `transcribe/tests/openrouter_q2.rs`, `LAT1.md`); the constant went from inference-net, together, coreweave to together, coreweave, inference-net. |
| 2 | Request body test pins the new order with `allow_fallbacks: true`, `zdr: true`, `data_collection: "deny"` | PASS | Both the unit test in `cleanup.rs` and `openrouter_q2.rs` pin the whole provider object. |
| 3 | `TIMEOUT` still 1.5 s | PASS | Unchanged; asserted at `crates/core/src/cleanup.rs`. |
| 4 | Gate | PASS | `scripts/gate.sh`: all checks passed. |

No stale reference to the old order remains outside docs/history. No VM run (not asked).
