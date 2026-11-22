# BENCH1: Vocet and other open-source Mac dictation apps on the same 151 clips

Spec: `docs/history/milestones/BENCH1.md`. The bench is its own MIT repository,
[vocetlabs/dictation-bench](https://github.com/vocetlabs/dictation-bench) (built on this branch, then split
out with its history); its README has the method, the app configurations and how to reproduce. This page is
the milestone's report.

## Results

First full runs, 2026-11-22: [vocetlabs/dictation-bench run 44959966210](https://github.com/vocetlabs/dictation-bench/actions/runs/44959966210)
at bench commit [`d0fbb82`](https://github.com/vocetlabs/dictation-bench/commit/d0fbb82) (the Vocet rerun below:
[`599fb5d`](https://github.com/vocetlabs/dictation-bench/commit/599fb5d)),
one GitHub-hosted `macos-15` runner per app (Apple M1 virtual, 3 cores, 7 GB, paravirtual GPU), all 151 clips,
accuracy only (`--accuracy-only`: 60 s text deadline, no latency reported). Judge: `anthropic/claude-opus-5.5`
through OpenRouter, reasoning effort high, amend-va 0.2.1 prompt `v1` (fingerprint `8ed04caf4663`). Every run
has exactly one app outcome per clip and no infrastructure faults. The numbers come from the uploaded
`score.json` (WER, outcomes) and `judge.json` (ZER, AMEND). `./bench verify` checks `score.json` only: it
recomputes the WER totals, edit and word counts, failure rate and (for timed runs) the latency percentiles
from the per-clip numbers in the same file, and the clip count. It does not check `judge.json`; ZER and AMEND
there are computed from its own per-clip edit counts.

| App | Version | Local model | Outcomes | WER intended % | WER spoken % | ZER % | AMEND % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muesli | 0.8.6 | Parakeet Unified EN 0.6B, Core ML | 151 ok | 7.56 | 10.02 | 50.3 | 1.25 |
| Handy | 0.10.1 | Parakeet Unified EN 0.6B, Q8_0 GGUF | 151 ok | 7.98 | 9.71 | 49.7 | 1.50 |
| FluidVoice | 1.6.13 | Parakeet TDT 0.6B v3, Core ML | 151 ok | 10.48 | 9.33 | 49.0 | 2.30 |
| Vocet | a7c7a46 (source) | OrukQwen 1.7B + Gemma 4 E2B cleanup | 150 ok, 1 late | 12.95 | 8.98 | 58.9 | 4.19 |

Lower WER and AMEND are better; higher ZER is better. WER against the intended text rewards an app that
writes what the speaker meant (punctuation and casing don't count, but cleanup that drops filler words or
fixes self-corrections does); WER against the spoken text rewards a verbatim transcript. A clip with no
output (Vocet's one `late` clip, text after the 60 s deadline) counts every reference word, and in AMEND
every intended character, as an error.

**Vocet's row on a runner ran almost without cleanup.** Its on-device cleanup (Gemma 4 E2B) has a 4 s
budget per dictation. A rerun that counted the cleanup outcomes in Vocet's own log (numbers only; run
[44970638445](https://github.com/vocetlabs/dictation-bench/actions/runs/44970638445)) found 2 applied and
148 `fallback_timeout` out of the 150 dictations with text: on a 3-core virtual runner Vocet pasted the raw
OrukQwen text almost every time, which fits its best spoken and worst intended WER. That rerun scored 149 ok,
1 empty, 1 late: WER intended 15.91, spoken 11.96, ZER 60.3, AMEND 7.18 (two clips with no output instead of
one). Vocet's runner numbers are therefore not Vocet as a Mac with a faster GPU runs it; the REL2 runs on this
Mac measure that. Key-up to text on the runner was 12-56 s per clip; it is not a speed measurement.

**Speed** (end of speech to final text, p50/p95, failure rate) needs a quiet real Mac and is not measured yet.

## Apps

| App | Unattended setup on a runner | Smoke (synthetic sentence) |
| --- | --- | --- |
| Handy 0.10.1 | yes | 12/12 words |
| Muesli 0.8.6 | yes | 12/12 words |
| FluidVoice 1.6.13 | yes | 12/12 words |
| Vocet (built from vocetlabs/dictation-app@a7c7a46) | yes (source build on the runner) | 12/12 words |
| VoiceInk 2.27 | no: reaches recording, then VoiceInk ends each recording at once ("captured less than 150 ms"); cause not found | - |
| OpenWhispr 1.12.0 | no (stopped at its 2-hour cap): settings written through its DevTools protocol, but neither its Globe/Fn default (software can't press it) nor Right Option starts a recording; no log without its debug setting | - |

## Acceptance criteria

1. **[auto] Harness and scorer have tests** (in vocetlabs/dictation-bench; `./test.sh`, standard library only,
   43 tests at `599fb5d`, all passing): `test_harness.py` runs the clip loop against a stub app on a fake
   clock (the harness dry run; `./bench dry-run` does the same from the command line), `test_score.py` scores
   fixed strings and refuses incomplete or mismatched runs, `test_judge.py` covers the judge with fake
   endpoints. On real runners, the smoke matrix at `599fb5d` (run
   [44970632009](https://github.com/vocetlabs/dictation-bench/actions/runs/44970632009)) passed for all four
   apps. The bench's workflow runs the apps, not `./test.sh`; the tests run locally.
2. **[auto] Vocet black box vs shortcut agree within noise: not done, open as #360** (below).
3. **[manual]** Lead review of this report.

## Vocet: black box vs `--debug-audio-file` (acceptance criterion 2, open: #360)

Not done. A check that drove Vocet's debug-only `--debug-audio-file` shortcut through the bench's loop and
compared it with a black-box run (full paired coverage, intended-WER difference within 1.5 points, fixed
beforehand) was written, but it was dropped from this branch when the bench moved to its own repository: it
needs the bench checked out and couldn't be tested by this repository's gate. Follow-up: #360.

## Runs in this repo

`eval/bench1_vm.sh` (internal) runs the bench (`BENCH_DIR`, a local clone of vocetlabs/dictation-bench) inside
the Lume VM `dictation-vm-bench` (a clone of
`dictation-vm-golden`, 8 GB, 4 CPUs, macOS 15.6.1) while holding the `dictation-vm-2` e2e lock, and logs host
load at the start and end of each run. In that VM, granting Accessibility to a third-party app needs the VM
user's password at macOS's sheet, which takes a person at the VM's display (keys sent over VNC don't reach
it); Vocet is covered by the golden image's grants.

## Follow-ups

- #360: AC 2, the Vocet black-box vs shortcut check.
- #361: Vocet's local cleanup times out on slower hardware (148 of 150 on a runner).
- vocetlabs/dictation-bench#1, #2: unattended setup for VoiceInk and OpenWhispr.
- Speed: the REL2 release-gate runs are done. Vocet `2044730` release build, timed, all 151 clips, in
  `dictation-vm-bench` on the owner's Mac (4 virtual CPUs, 8 GB), 2026-11-22, with the bench at `599fb5d` and two
  local run configs (`vocet-cloud`, `vocet-local`, not in the bench repository). They were judged with
  `eval/bench1_judge_local.sh`.
  - Cloud: 149 ok, 2 empty; WER intended 7.85, spoken 11.76; key-up to paste p50 2.09 s, p95 4.27 s; cleanup
    127 applied, 21 timed out, 1 guarded; ZER 76.8, AMEND 2.25.
  - Local: 151 ok; WER intended 10.36, spoken 6.67; key-up to paste p50 6.87 s, p95 17.46 s; cleanup 41
    applied, 108 timed out, 2 guarded; ZER 64.2, AMEND 1.16.
  - Against the REL2 gates, in the VM: cloud ZER 76.8 misses its 85 gate; local ZER 64.2 misses its 75 gate
    (most local cleanups timed out); cloud speed misses p50 ≤ 2.0 s and p95 ≤ 3.5 s. Local speed on 8 GB is
    recorded only; its p50 ≤ 1.5 s gate is for a 16 GB Mac. The real-Mac speed runs are still to do.
