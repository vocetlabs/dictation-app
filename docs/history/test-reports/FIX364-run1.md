# FIX364 test report, run 1

PR: #373 at 85bb9f06
Result: PASS (bench-clip replay not run, see below)

| # | Check | Result | Notes |
| - | ----- | ------ | ----- |
| 1 | Gate | PASS | `scripts/gate.sh`: all checks passed. |
| 2 | New unit tests | PASS | 15 `fix364`/`resync` tests pass: a resync that still shows the hotkey held keeps the recording and a later release transcribes it; a resync with no further input never transcribes (discard at the limit); a resync without the right side interrupts; `matcher.rs` `a_resync_forgets_escape` (Esc cleared); `RecordingAfterResync` release, max-duration and no-input paths in `coordinator.rs`; every end has a reason. |
| 3 | Hotkey e2e (dictation-vm-2) | PASS | `e2e_hold_release`, `e2e_hotkey_listener_recovers`, `e2e_hotkey_recorder`, `e2e_hotkey_shortcuts`, `e2e_cancel_and_busy_presses`: pass. |
| 4 | Core dictation e2e | PASS | `e2e_rapid`, `e2e_clipboard_restore`, `e2e_paste_leaves_no_modifier`, `e2e_first_paste_after_launch`: pass. 9 passed, 0 failed, 0 skipped in all. |
| 5 | Info log names why each recording ended | PASS | App logs: `recording ended reason=Released` (hold, rapid), `reason=Cancelled` plus `a hotkey event ended the recording hotkey=CancelPressed` / `ShortcutPressed` (Esc and shortcut scenarios). No text in the lines. |
| 6 | Held Right Option survives a forced tap timeout / resync in the VM | NOT TESTABLE | No scenario hook can produce a resync while a modifier stays held: `--debug-hotkey-outage` kills the listener instead. The VM logs show the resync line only with `hold_kept=false` (startup/after release). The kept-hold path is covered by the unit tests (item 2) only. |
| 7 | Replay of dict_0083 and dict_0103, five times each | NOT RUN | `eval/bench1_vm.sh` drives the reserved `dictation-vm-bench` (not `dictation-vm-2`) and a real speech/cleanup provider needs an OpenRouter key; the brief says no keys. Needs the Lead to run it. |

## Untested behaviour found
- The shutdown end reason is logged in `Runner::run` after the loop (`pipeline.rs`); the coordinator test covers the enum value but no pipeline test asserts that line. Minor.
- `hold_kept=true` has no e2e coverage (item 6).
