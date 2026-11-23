# EVAL1 test report, run 1

PR: #378 at 176f3b35
Result: PASS

| # | Criterion / check | Result | Notes |
| - | ----------------- | ------ | ----- |
| 1 | Gate | PASS | `scripts/gate.sh` all checks passed, including `cargo deny check`; `Cargo.lock` has cookie 0.18.3 (the RUSTSEC-2026-0594 fix). |
| 2 | Default build | PASS | `a_normal_build_records_nothing`, the guard test and the parser test pass without the feature. In dictation-vm-2, a normal debug build with the fake provider and one dictation (pasted text correct): no `eval/` folder and no `drafts*` file anywhere in the app data dir. |
| 3 | Build with `--features eval-capture` | PASS | Same scenario on a `--features eval-capture` build: `eval/` is `drwx------` (700), `drafts.jsonl` is `-rw-------` (600), exactly one line. Fields: `finished_at_ms` (number), `raw`, `final` (strings), `cleanup` = `applied`. The app log has the "eval build: saving…" line with the path only, and none of the dictated text. The three eval-gated unit tests also pass with the feature. Text is not reproduced here. |
| 4 | Guard test | PASS | Locally adding `default = ["eval-capture"]` to `src-tauri/Cargo.toml` makes `eval_capture_is_off_by_default_and_never_in_a_release` fail ("eval-capture must not be a default feature"). Reverted; nothing committed. |

The VM check used a temporary local scenario (not committed, removed). The script, DMG, tauri config, package.json and CI check is inside the same guard test (passes in the gate).
