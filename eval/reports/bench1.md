# BENCH1: Vocet and other open-source Mac dictation apps on the same 151 clips

Spec: `docs/history/milestones/BENCH1.md`. The bench is its own MIT repository,
[vocetlabs/dictation-bench](https://github.com/vocetlabs/dictation-bench) (built on this branch, then split
out with its history); its README has the method, the app configurations and how to reproduce. This page is
the milestone's report.

## Results

First full runs, 2026-11-22: [vocetlabs/dictation-bench run 44959966210](https://github.com/vocetlabs/dictation-bench/actions/runs/44959966210),
one GitHub-hosted `macos-15` runner per app (Apple M1 virtual, 3 cores, 7 GB, paravirtual GPU), all 151 clips,
accuracy only (`--accuracy-only`: 60 s text deadline, no latency reported). Judge: `anthropic/claude-opus-5.5`
through OpenRouter, reasoning effort high, amend-va 0.2.1 prompt `v1` (fingerprint `8ed04caf4663`). Every run
has exactly one app outcome per clip and no infrastructure faults; the numbers come from the uploaded
`score.json` and `judge.json`, which `./bench verify` recomputes.

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

**Vocet's row on a runner.** Its on-device cleanup (Gemma 4 E2B) has a 4 s budget per dictation; on a 3-core
virtual runner it likely timed out on most clips, so Vocet pasted the raw OrukQwen text (best spoken WER,
worst intended WER). The rerun below counts the cleanup outcomes from Vocet's own log (numbers only):
_pending_. Key-up to text on the runner was 12-56 s per clip; it is not a speed measurement.

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

## Vocet: black box vs `--debug-audio-file` (acceptance criterion 2)

Not done. A check that drove Vocet's debug-only `--debug-audio-file` shortcut through the bench's loop and
compared it with a black-box run (full paired coverage, intended-WER difference within 1.5 points, fixed
beforehand) was written, but it was dropped from this branch when the bench moved to its own repository: it
needs the bench checked out and couldn't be tested by this repository's gate. Follow-up issue below.

## Runs in this repo

`eval/bench1_vm.sh` (internal) runs the bench (`BENCH_DIR`, a local clone of vocetlabs/dictation-bench) inside
the Lume VM `dictation-vm-bench` (a clone of
`dictation-vm-golden`, 8 GB, 4 CPUs, macOS 15.6.1) while holding the `dictation-vm-2` e2e lock, and logs host
load at the start and end of each run. In that VM, granting Accessibility to a third-party app needs the VM
user's password at macOS's sheet, which takes a person at the VM's display (keys sent over VNC don't reach
it); Vocet is covered by the golden image's grants.
