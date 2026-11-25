# MCLN1 test report, run 2

PR: #383 at 3d5a13cc (test and report commits on top; product code is 514e33e8)
Result: PASS

Re-check of the changes since f45c37b5: criterion 2b (`UnresolvedCancel`), and that criteria 1-5 still pass.

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | v7 prompt byte for byte | `cmp` with `cln1-prompt-v7.txt`: identical; pinned test | PASS | |
| 2 | Relaxed number/name rule, links strict | existing core tests, `cln1_spec_cases` | PASS | |
| 2b | `UnresolvedCancel` verdict, Rust and `guard.py` | `a_cancel_cue_removed_without_cancelling_falls_back`, `an_applied_cancellation_is_accepted`, `the_cancel_check_needs_a_removed_whole_cue`, verdict name test, mirrored `CorrectionGuardTests`; added `unresolved_cancel_spec_edges`; differential below | PASS | Pipeline pastes raw for any non-Accepted verdict and logs only `refused.name()` (`crates/app/src/pipeline.rs`, read, unchanged) |
| 3 | Unit tests | existing core tests, `cln1_spec_cases` | PASS | Accepted run 1 deviation unchanged |
| 4 | Local prompt fillers | no change since b832df8c under `local_cleanup`; pinned test | PASS | |
| 5 | `eval/guard.py` + mirrored tests | `python3 -m unittest discover -s eval -p 'test_*.py'`: 75 run, OK (1 skipped) | PASS | |
| 6, 7 | `[manual]` | Lead | n/a | |

## Differential check (temporary harness, not committed)
60,000 random synthetic pairs, weighted to cancel cues, number words, apostrophes and partial words:
Rust `judge` and `guard.judge` gave the same verdict on all of them (3,207 `unresolved_cancel` from Rust).
`guard.unresolved_cancel` matched the offline prototype on every pair without "nevermind" in the transcript.
`STOP` and the skip list equal the prototype's. The only cue word added is "nevermind", which the PR notes
explain and which 2b's "apart from the cue words themselves" covers. This is not an exhaustive Unicode check.

## Gate
`scripts/gate.sh`, foreground, full mode, clean tree at 514e33e8: all checks passed (nextest workspace,
1498 tests, 3 skipped). Coverage: core 98.69%, transcribe 92.49%, app 97.22%. It was run again on the final
tree with the added test and this report before the push (see the PR comment). No API keys, no paid calls,
no VM e2e (not required for `[auto]` criteria).

## Untested behaviour found
Added `unresolved_cancel_spec_edges`: existing checks take precedence, number words and digits match in both
directions, curly apostrophe, one of the two words before the cue gone, multiset comparison.

Minor (matches the spec, so not a failure): condition (b) covers the whole transcript, so once the reply drops
any other content word (such as an applied first correction), a second, unapplied cancellation is accepted.
Pinned by the added test; filed as #384.

## Failures
None.
