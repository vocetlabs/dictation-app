# MCLN1 test report, run 1

PR: #383 at b832df8c (report commit on top)
Result: PASS

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | v7 prompt byte for byte | `cmp` of `cleanup.txt` with `cln1-prompt-v7.txt`: identical; `criterion_1_the_prompt_is_v7_byte_for_byte`, `the_prompt_carries_v7s_rules` | PASS | |
| 2 | Relaxed number/name rule, links strict | `judge`/`corrected` read in the diff; `a_dropped_link_is_refused_even_with_a_cue`; new `cln1_spec_cases` | PASS | Check order unchanged |
| 3 | Unit tests | `a_resolved_self_correction_is_accepted`, `dropping_the_corrected_value_or_one_with_no_cue_still_falls_back`, `corrected_reads_the_cue_window_and_whole_words`, matrix row in `cleanup_guard.rs`; added `cln1_spec_cases` with the spec sentences verbatim | PASS | Bare "20 copies, make that 30" -> "30 copies" is `Echo` (raw pasted); Lead accepted this deviation, not counted as a failure |
| 4 | Local prompt fillers | diff shows only "erm", "hmm", "mm" added; `local_cleanup::tests::the_prompt_is_v3_byte_for_byte` | PASS | |
| 5 | `eval/guard.py` + mirrored tests | `python3 -m unittest discover -s eval -p 'test_*.py'`: 72 run, OK (1 skipped) | PASS | |
| 6, 7 | `[manual]` | Lead | n/a | |

## Gate
`scripts/gate.sh` run in the foreground on a clean tree at b832df8c: all checks passed (nextest workspace, 1493 tests, fmt, clippy, doc links, workflows, e2e script tests). No API keys, no paid calls, no VM e2e (not required for [auto] criteria).

## Untested behaviour found
Added `crates/core/tests/cln1_spec_cases.rs`: spec sentences verbatim, a name corrected once but repeated uncorrected (`DroppedName`), empty reply, cue outside the 30 character window, and non-ASCII text next to a number (no panic). All pass. No product bugs found.

## Failures
None.
