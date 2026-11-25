# REL3 test report, run 1

PR: #385 at 4622d11b (full checks at c5dec640; what 4622d11b changed was re-checked)
Result: PASS (criteria 1 and 2; criteria 3 to 5 are manual and were not checked)

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Version 0.2.1; `scripts/test-release.sh` passes | the three reads `scripts/release.sh` makes; lock file reads; `cargo metadata --locked --offline`; `scripts/test-release.sh` in the gate | PASS | `tauri.conf.json` (`jq .version`), `package.json` and the first `version =` line of `Cargo.toml` are 0.2.1. So are both workspace entries in `package-lock.json` and all 7 `dictation-*` packages. The lock file diffs change only those versions. `test-release.sh` builds its own fixture repo at 0.3.0, so the real version fields are checked by the direct reads. |
| 2 | CHANGELOG section matches the spec, dated 2026-11-25 | `changelog_notes 0.2.1 CHANGELOG.md` (the function taken from `release.sh`) diffed against the spec's code block with its 3-space indent removed | PASS | Identical, 10 lines. The heading `## [0.2.1] — 2026-11-25` is directly under `[Unreleased]`. The compare links are updated. |

Also checked:

- `docs/TESTERS.md` says **New in 0.2.1**. Its summary agrees with the changelog section.
- No code changed. The diff against `origin/main` is `CHANGELOG.md`, `Cargo.toml`, the two lock
  files, `package.json`, `tauri.conf.json` (version lines only in the last five),
  `docs/TESTERS.md` and `docs/history/milestones/REL3.md`.

`scripts/release.sh` was not run (only its text was read, and `changelog_notes` was run on its own).
No Keychain item was read. No VM e2e was run: it is criterion 3, the Lead's.

## Gate

`scripts/gate.sh` on macOS at c5dec640: all checks passed. It was started in the foreground; it
ran past the tool's 10-minute limit and finished in the background (same run, exit 0).

- Rust and script tests: passed. Vitest: 380 passed in 17 files.
- Coverage: `core` 98.69%, `transcribe` 92.49%, `app` 97.17%.
- The gate also passed as the pre-push hook on each of my two earlier push attempts (both
  rejected because the branch had moved). The push of this report runs it again.
- CI had not finished when this was written. The merge needs it green on the final head.

## Untested behaviour found

This PR changes no behaviour, so no test was added.

Outside criteria 1 and 2: at c5dec640 the changelog's example "20 copies, make that 30" did not
work as the bare utterance. The test `a_reply_that_is_the_prompts_own_correction_example_is_an_echo`
(`crates/core/src/cleanup.rs`) expects the reply "30 copies" to be judged an echo, so the raw text
is pasted. The Reviewer raised it as a major (`docs/history/reviews/REL3-round1.md`).

## Re-check at 4622d11b

4622d11b replaces the examples in the spec, the changelog and `docs/TESTERS.md`. It changes no
other file. (06c11d95, before it, adds only the review.)

- Criterion 2: PASS. The `changelog_notes` output is again identical to the spec's new code
  block (10 lines), and the heading is unchanged.
- `docs/TESTERS.md` still says **New in 0.2.1**, with an example that matches the changelog.
- Still no code change. The version files did not change, so criterion 1 stands.
- Not verified by me: that the guard accepts the two new examples. A search of `crates/` and
  `eval/` for them found no match, and I ran no test on them.

## Failures

None.
