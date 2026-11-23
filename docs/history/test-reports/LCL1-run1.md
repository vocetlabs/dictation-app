# LCL1 test report, run 1

PR: #371 at f9fc59bb
Result: PASS

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Gate passes | CI on the PR (see Gate) | see Gate | Local run of the gate not repeated; the pre-push gate runs it on push |
| 2 | `eval/test_local_cleanup_screen.py` passes offline | `python3 -m unittest discover -s eval -p test_local_cleanup_screen.py -v` | pass | 12 tests OK in 0.5 s; the only network use is a loopback server on 127.0.0.1 with a dead proxy set |
| 3 | No clip text or model outputs committed | Diff file list; grep of the diff for CSVs, run folders, transcripts | pass | 7 files: spec, candidates JSON, three scripts, report, test. No CSV or run output; the report has numbers only; the scripts only name `transcript` as a column |
| 4 | Report numbers match `local_cleanup_candidates.json` | Script: all 12 labels have a report row; licence per row equals the JSON; SHA-256 of the 4 downloaded files equals the report's download table | pass | Sizes, timings, guard counts and judge scores are not in the JSON (they come from git-ignored run summaries), so those could not be checked here; no model runs, per the brief |
| 5 | Run script usage is valid | `bash -n`; run with no env and with `-h`; `--help` of the screen and report scripts | pass | Header usage is correct; missing `DRAFTS` and `-d` give clear errors; bad option exits 2 |

## Gate
CI checks on the PR: see the PR comment for the state when posted.

## Untested behaviour found
The real runs (llama-server, Keychain, judge) were not run, by the brief. Minor: `local_cleanup_run.sh -h` prints "illegal option" instead of the usage; not blocking.

## Failures
None.
