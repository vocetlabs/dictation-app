# BENCH1: Vocet and other open-source Mac dictation apps on the same 151 clips

Spec: `docs/history/milestones/BENCH1.md`. The bench is its own MIT repository,
[vocetlabs/dictation-bench](https://github.com/vocetlabs/dictation-bench), split with its history from
[`eval/app_bench/`](../app_bench/) here (the two are kept in step); its README has the method, the app
configurations and how to reproduce. This page is the milestone's report.

## Results

_Pending: the first full runs (all 151 clips, GitHub-hosted macOS runners, accuracy only, judge on)._

Accuracy (WER against the intended and spoken texts; ZER and AMEND from the optional judge) comes from
GitHub-hosted macOS runners, one job per app, numbers-only artifacts. Speed (end of speech to final text,
p50/p95, with the failure rate) needs a quiet real Mac and is not measured yet. The two sources are reported
in separate tables.

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

`eval/bench1_vocet_check.py` (internal, not part of the bench) runs a debug build of Vocet through its
`--debug-audio-file` shortcut with the bench's loop, and `compare` pairs it with a black-box run of the same
build and settings. Agreement, fixed before running: both cover exactly the same clips with app outcomes,
and their intended-text WERs differ by at most 1.5 points; the report also gives the discordant clips and
the share of identical normalized texts. _Not run yet: it needs a Mac or VM with the debug build and Vocet's
grants (`eval/bench1_vm.sh`)._

## Runs in this repo

`eval/bench1_vm.sh` (internal) runs `./bench` inside the Lume VM `dictation-vm-bench` (a clone of
`dictation-vm-golden`, 8 GB, 4 CPUs, macOS 15.6.1) while holding the `dictation-vm-2` e2e lock, and logs host
load at the start and end of each run. In that VM, granting Accessibility to a third-party app needs the VM
user's password at macOS's sheet, which takes a person at the VM's display (keys sent over VNC don't reach
it); Vocet is covered by the golden image's grants.
