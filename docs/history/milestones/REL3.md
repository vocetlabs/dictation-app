# REL3: Vocet 0.2.1, cleanup understands self-corrections

Owner decision, 2026-11-25: ship CLN1 (merged #383, 3a5f8bd) as 0.2.1.

## Contents

Since 0.2.0 (b99f79b) main has: CLN1 (#383, cloud cleanup prompt v7 + correction and cancel guards, local prompt
filler words), EVAL1 (#378, an `eval-capture` build feature, off in release builds: no user-visible change), and
website-only PRs (#380, #381). Nothing else.

## Acceptance criteria

1. `[auto]` Version 0.2.1 in `src-tauri/tauri.conf.json`, `package.json`, `Cargo.toml` (and the lock files where
   they record the workspace version), per `docs/releasing.md`. `scripts/test-release.sh` passes.
2. `[auto]` `CHANGELOG.md`: a `## [0.2.1] — [date set at release]` section under `[Unreleased]`, with exactly this
   text (plain text for testers, it becomes the release notes and the "Update available" text):

   ```
   Cloud cleanup now understands when you correct yourself.

   - **Self-corrections.** Say "Tuesday, sorry, Wednesday" or "20 copies, make
     that 30" and Vocet writes only what you meant: "Wednesday", "30 copies".
     It also removes a few more filler sounds and ends a sentence with a
     period when you forget one.
   - **"Scratch that" is safe.** If the cleaned text drops "scratch that" or
     "never mind" but keeps what you cancelled, Vocet pastes your plain
     transcript instead, so a cancelled instruction never reads as a real one.
   - **On this Mac.** On-device cleanup also removes "erm", "hmm" and "mm".
   ```
3. `[manual]` Lead: full VM e2e on the release commit passes.
4. `[manual]` Lead: a live cloud run of the 151 Voice Arena clips through the release-commit app in the VM
   (quiet machine): ZER ≥ 83.5 (0.2.0 shipped 86.8 live; offline v7 replays 83.4–85.4) and key-up-to-paste
   p50 ≤ 2.0 s, p95 ≤ 5.0 s, because the v7 prompt is longer and cleanup has a 3 s deadline.
5. `[manual]` Owner: on the merged commit, `scripts/release.sh 0.2.1` (dry run), then
   `scripts/release.sh 0.2.1 --publish` (the release script reads the Keychain and notarises; agents never do).
   Lead then checks the release page, `latest.json` and an update from 0.2.0 in the VM.

## Out of scope

Any code change. The date in the changelog heading is set at release, as the script requires.
