# BENCH1 test report, run 1

PR: #362 at c981f7e2
Result: PASS

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Gate passes | CI: Quality gate (Linux), Platform crate (macOS) | pass | Local `scripts/gate.sh` stopped at "node_modules is missing"; not re-run after npm ci, CI is the evidence |
| 2 | Report numbers match run 44959966210 | Downloaded the run's artifacts, read score.json and judge.json | pass | Muesli 7.56/10.02/50.3/1.25, Handy 7.98/9.71/49.7/1.50, FluidVoice 10.48/9.33/49.0/2.30, Vocet 12.95/8.98/58.9/4.19 (WER intended/spoken/ZER/AMEND); Vocet outcomes 150 ok, 1 late; all 151 clips |
| 3 | Report numbers match run 44970638445 | Same | pass | Vocet WER 15.91/11.96, ZER 60.3, AMEND 7.18; outcomes 149 ok, 1 empty, 1 late; app_log_counts applied 2, fallback_timeout 148 |
| 4 | Says Vocet's runner row ran almost without cleanup (148 of 150 timeouts) | Read report | pass | "ran almost without cleanup"; 2 + 148 = 150 |
| 5 | No clip text | Read report | pass | Numbers and run IDs only |
| 6 | Every link resolves | `curl -sIL` | pass | Bench repo and both run URLs return 200; both runs concluded success. Issue references (#360, #361) are plain text, not links |
| 7 | Scripts: `bash -n`, usage only | `bash -n` both; ran judge script with no args, vm script with `--help` | pass | Both parse; judge prints usage; vm prints its header usage |
| 8 | Judge script never echoes the key, refuses `set -x` | Read script; ran `bash -x` | pass | Key is read into a variable, passed only as `JUDGE_API_KEY=$key` in the judge process's environment, then unset; no echo. `bash -x` prints "refusing to run with set -x" and exits |
| 9 | No workflow changes | `git diff origin/main...HEAD --name-only` | pass | 5 files, none under .github |

## Gate
CI on the PR: both required checks pass.

## Untested behaviour found
`bench1_vm.sh` and the real judge run (Keychain, VM, lock) were not run, by the brief. Criterion 2 of the milestone (black box vs shortcut) is declared not done in the report and tracked in #360.

## Failures
None.
