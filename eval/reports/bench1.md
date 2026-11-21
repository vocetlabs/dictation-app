# BENCH1: Vocet and other open-source Mac dictation apps on the same 151 clips

Spec: `docs/history/milestones/BENCH1.md`. The bench is self-contained in [`eval/app_bench/`](../app_bench/)
(MIT, to be published as its own repository); its [README](../app_bench/README.md) has the method, the app
configurations and how to reproduce. This page is the milestone's report. Nothing here is published yet:
the dataset's use for this comparison is the owner's decision.

## Results

_Pending._ Accuracy (WER against the intended and spoken texts) comes from GitHub-hosted macOS runners, one
job per app (`.github/workflows/bench.yml`); speed (end of speech to final text, p50/p95, with the failure
rate) from a quiet real Mac. The two sources are reported in separate tables.

## Status of the pieces

| Piece | State |
| --- | --- |
| Harness: outcomes (ok, partial, empty, late) kept apart from infrastructure faults; only faults retried; quiet period and toggle-app restart after an unclear outcome; verified target; latency from the end of speech | done, unit-tested against a simulated app |
| Scoring: WER refuses incomplete, duplicated, faulty or mismatched runs; Unicode folding; numbers-only `score.json` with a verifier | done, unit-tested on fixed strings |
| Run fingerprint bound to resume and scoring | done |
| Hosted runner: logged-in session, SIP off, TCC rows, BlackHole loopback, Metal | probed: works (Handy end to end on a synthetic clip) |
| Unattended setup | Handy; Muesli, FluidVoice, VoiceInk, Vocet, OpenWhispr next |

## Vocet: black box vs `--debug-audio-file` (acceptance criterion 2)

`eval/bench1_vocet_check.py` (internal, not part of the bench) runs a debug build of Vocet through its
`--debug-audio-file` shortcut with the bench's loop, and `compare` pairs it with a black-box run of the same
build and settings. Agreement, fixed before running: both cover exactly the same clips with app outcomes,
and their intended-text WERs differ by at most 1.5 points; the report also gives the discordant clips and
the share of identical normalized texts. _Pending._

## Runs in this repo

`eval/bench1_vm.sh` (internal) runs `./bench` inside the Lume VM `dictation-vm-bench` (a clone of
`dictation-vm-golden`, 8 GB, 4 CPUs, macOS 15.6.1) while holding the `dictation-vm-2` e2e lock, and logs host
load at the start and end of each run. In that VM, granting Accessibility to a third-party app needs the
VM user's password at macOS's sheet, which takes a person at the VM's display (keys sent over VNC don't
reach it); Vocet is covered by the golden image's grants.
