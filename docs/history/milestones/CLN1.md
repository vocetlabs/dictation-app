# CLN1: cloud cleanup resolves self-corrections (prompt v7 + relaxed guard)

## Why

Offline tests on 2026-11-24 (owner-authorized) compared the shipped cloud cleanup prompt with a new one (v7)
that resolves explicit self-corrections ("Tuesday, sorry, Wednesday" becomes "Wednesday"), adds a final period
when one is missing and deletes a few more fillers. Results (GLM 5.3 Flash, the app's routing and guard):

| | Shipped prompt | v7 |
|---|---|---|
| Voice Arena, 151 clips, Claude judge, mean of runs | 85.0% (5 runs, 83.4 to 86.1) | 84.5% (3 runs, 84.1 to 85.4) |
| Disfl-QA, 800 rows, held out: exact matches | 16% | 50% |
| Vox, 1,199 rows, held out: WER | 6.5% | 6.0% |
| Kanso: already-clean rows left unchanged | 98.7% | 99.3% |
| Handy eval, 2,152 rows: WER | 0.37 | 0.09 |
| 40 cancelled-instruction cases: reversals | 0 | 0 (2 runs) |

The owner decided (2026-11-24): ship it, since Voice Arena is not measurably worse. Known cost: when a draft
needs edits, v7's edits are slightly larger (judge AMEND 0.28% to 0.44%). The local Gemma prompt is unchanged
except for the extra filler words (offline: v7-style rules had no effect on Gemma 4 E2B).

The shipped guard pastes the raw text when the reply drops a number or a capitalised name, which would undo
"20 copies, make that 30" to the raw text. The guard needs the same exception the offline test used.

Inputs (local, read only): `~/vocet-screens/u9/cln1-prompt-v7.txt` (the prompt, final text),
`~/vocet-screens/u9/cln1-guard-relaxed.py` (the offline Python rule to port), `~/vocet-screens/u9/cln1-cancel-cases.jsonl`
(40 hand-written and Handy cases, text only, CC BY 4.0 for the Handy rows; evaluation only).

## Acceptance criteria

1. `[auto]` `crates/core/prompts/cleanup.txt` holds the v7 prompt text exactly (byte for byte with the input
   file, trailing newline as the current file has it). Prompt tests that pin phrases are updated to v7.
2. `[auto]` `crates/core/src/cleanup.rs` `judge`: a number or a capitalised name missing from the reply is
   allowed when every occurrence of it in the raw text is followed within 30 characters by a correction cue
   (`sorry`, `wait`, `no`, `actually`, `make that`, `I mean`, `rather`, `scratch that`, `correction`, case
   insensitive, whole words), ported from `judge_relaxed`/`corrected` in the input file. Links (emails, URLs,
   file names) keep the strict rule: never dropped. All other checks and their order are unchanged.
2b. `[auto]` `crates/core/src/cleanup.rs` `judge` gets a new verdict, `UnresolvedCancel` (pastes the raw text
   like the other non-Cleaned verdicts), checked after the existing checks pass. It fires when, for any occurrence
   in the raw text of a whole-clause cancel cue (`scratch that`, `never mind`/`nevermind`, `forget that`,
   `forget it`, `ignore that`, `cancel that`, `delete that`; case insensitive, whole words) that the reply does
   not contain:
   (a) the last two content words before the cue (skipping `actually wait sorry no oh ok okay well`) are both
   present in the reply, and
   (b) no content word of the raw text is missing from the reply apart from the cue words themselves and that
   skip list (multiset comparison).
   Content words: lowercase word tokens (letters, digits, apostrophes; curly apostrophe normalised) minus the
   `STOP` list of the offline prototype (`~/vocet-screens/u9/cln1-unresolved-proto.py`); number words zero to
   twelve map to digits on both sides. If the reply still contains the cue verbatim, this check does not fire.
   Added in round 2 (owner approved): the offline replay found replies that deleted the cue but kept the
   cancelled words. Rust tests and `eval/guard.py` (verdict `unresolved_cancel`) mirror each other. Only the
   verdict name is logged, never text.
3. `[auto]` Unit tests: "20 copies, make that 30" → "30 copies" is `Cleaned`; "Email Carlos, I mean Carla" →
   "Email Carla" is `Cleaned`; "version 3.1, wait, no, 3.2" → "version 3.2" is `Cleaned`; dropping a number with
   no cue after it is still `DroppedNumber`; a number that appears twice, once uncorrected, dropped is still
   `DroppedNumber`; a dropped email or URL is still `DroppedLink` even with a cue; the existing guard tests pass.
4. `[auto]` `crates/core/src/local_cleanup/prompt_v3.txt`: the filler-sound list adds "erm", "hmm" and "mm"
   and nothing else changes (pinned test updated). The local guard path uses the same `judge`.
5. `[auto]` `eval/guard.py` (the offline port) gets the same rule and its tests mirror the Rust ones, so offline
   evals match the app.
6. `[manual]` Lead: an offline Voice Arena replay through the built app's prompt and guard (or the Rust guard
   via a test harness) scores within 1.5 points of 85.0% on the mean of 2 runs, and the 40 cancellation cases
   show 0 reversals.
7. `[manual]` Lead: VM e2e on the merged SHA passes, including the cloud cleanup scenario.

## Out of scope

App-context-aware cleanup (different rules for AI prompts vs messages), any local model change, Apple
Foundation Models. Privacy: no transcript text in logs, tests use synthetic sentences only.
