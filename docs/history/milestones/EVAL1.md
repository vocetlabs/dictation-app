# EVAL1: eval builds save each dictation's raw and final text

Lead, 2026-11-22 (owner rule 2026-11-19: eval runs may keep verbatim and cleaned text; normal users never).
The bench (vocetlabs/dictation-bench) sees only what Vocet pastes. To split the gap between live and offline
results into a speech part and a cleanup part, an eval build also keeps the speech-to-text draft before
cleanup. The Lead approved this design as proposed.

## Acceptance criteria

1. `[auto]` A Cargo feature `eval-capture` on the shell (`src-tauri`), **off by default**. Only a build with
   it sets the pipeline's drafts log; every other build records nothing.
2. `[auto]` With the feature, each transcribed dictation appends one JSON line to
   `<app data>/eval/drafts.jsonl`: `finished_at_ms`, `raw` (the transcript), `final` (the text handed on
   for the paste) and `cleanup` (the outcome name, or `null` when no cleanup ran). The file is 0600 in a
   0700 folder, from the moment it exists. The texts are never logged, there is no UI, and the paste is
   unchanged.
3. `[auto]` A test fails if `eval-capture` becomes a default feature or if the release script, the DMG
   script, `tauri.conf.json`, `package.json` or CI enables it.
4. `[auto]` Unit tests with fakes: the JSON line (escaping included), the private file, and the pipeline
   recording raw, final and outcome for applied, fallback and no-cleanup dictations.
5. `[auto]` `docs/ENGINEERING.md` (Security and privacy) describes eval builds.

Out of scope: the bench side (a follow-up PR in vocetlabs/dictation-bench reads the file into a local
results column).
