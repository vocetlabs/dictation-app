# LCL1: small on-device cleanup models, screen (outputs and timing)

Numbers only. No judging yet, so the judge column is empty. 2026-11-22, M4 Pro 24 GB, macOS 15, llama.cpp
`llama-server` b12359 (the build Vocet pins) with Metal. Spec: `docs/history/milestones/LCL1.md`.

## Method

- **Inputs:** the 151 OrukQwen 1.7B drafts of the Voice Arena set, reused from the ASR screen (`runs/oruk.csv`
  there). Local and git-ignored; no text is committed.
- **Request = the app's:** prompt v3 (`crates/core/src/local_cleanup/prompt_v3.txt`, SHA-256 `7b791b1c...`),
  system turn plus `<transcript>` user turn, greedy, seed 1, `max_tokens` = chars/2 + 100, thinking off, the
  app's `server_args` (`-ngl 99 -c 4096 -np 1 --reasoning off`), then the app's guard (`eval/guard.py`).
  The screen streams the reply to time the first token; the app does not.
- **Timing:** one model loaded, one request at a time, quiet Mac (no builds, gates or VMs). The runner pauses
  while the one-minute load average is above 4 and records each pause in `summary.json`. Pauses happened in
  Gemma 3 1B (once), Granite 4.0 1B (once), Qwen3 1.7B Muesli (at the start) and Qwen3 4B Muesli (five times). Load
  average at the start of each run was 2.5 to 4.0. Peak memory is the peak resident size of the server process (polled every 0.2 s).
  A first pass on a busier Mac gave identical guard results and p50 times within about 5% (up to 7%
  for Qwen3 4B Muesli); this is the rerun.
- **Muesli framing** (Gemma4LiteRTBackend.swift, MIT): rules in the user turn, transcript in `<USER-INPUT>`,
  no system turn. Run for the top 2 by guard pass rate among working models: Qwen3 1.7B and Qwen3 4B.
- **Models:** each GGUF's SHA-256 equals the Hugging Face LFS id of the repo and file below. Eight were
  already on disk (`~/vocet-cleanup-models`, left alone); Llama 3.2 1B and the two Granite 4.0 files were
  downloaded and are deleted after the run. Nothing was dropped for lacking a GGUF. Gemma 4 E2B is the smallest
  Gemma 4, so Gemma 3 1B is the smaller Gemma. Gemma 3 270M (`unsloth/gemma-3-270m-it-GGUF`) was run after disk space was freed.

## Results

Fallbacks are replies the guard refused (the raw text is pasted). Changed is the share of drafts whose pasted
text differs from the raw text. Times are the cleanup request, in ms, over 151 clips (150 for Granite 350M:
one empty draft).

| Model (label) | Size | Licence | Guard fallbacks | Changed | Cleanup p50 / p95 (ms) | First token p50 (ms) | Load (s) | Peak RSS (MB) | VM p50 / p95 (ms) | Judge ZER |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Gemma 4 E2B (baseline) (`gemma4-e2b`) | 3.11 GB | Apache-2.0 | 5/151 | 50.3% | 387 / 2438 | 40 | 0.64 | 3425 | – | |
| Qwen3 0.6B (`qwen3-0.6b`) | 0.40 GB | Apache-2.0 | 3/151 | 28.5% | 161 / 982 | 22 | 0.33 | 1014 | – | |
| Qwen3 1.7B (`qwen3-1.7b`) | 1.11 GB | Apache-2.0 | 0/151 | 16.6% | 287 / 1795 | 44 | 0.43 | 1690 | – | |
| Qwen3 1.7B (Muesli framing) (`qwen3-1.7b-muesli`) | 1.11 GB | Apache-2.0 | 0/151 | 10.6% | 319 / 1940 | 58 | 0.44 | 1690 | – | |
| Qwen3 4B (`qwen3-4b`) | 2.50 GB | Apache-2.0 | 2/151 | 25.2% | 579 / 3678 | 104 | 0.54 | 3152 | – | |
| Qwen3 4B (Muesli framing) (`qwen3-4b-muesli`) | 2.50 GB | Apache-2.0 | 2/151 | 36.4% | 648 / 3781 | 147 | 0.54 | 3152 | – | |
| Gemma 3 1B (`gemma3-1b`) | 0.81 GB | Gemma terms (restrictive) | 8/151 | 37.8% | 250 / 1474 | 38 | 0.43 | 1073 | – | |
| Phi-4 mini 3.8B (`phi4-mini`) | 2.49 GB | MIT | 4/151 | 38.4% | 534 / 3263 | 85 | 0.54 | 3106 | – | |
| Llama 3.2 1B (`llama3.2-1b`) | 0.81 GB | Llama 3.2 community (restrictive) | 17/151 | 50.3% | 205 / 1232 | 31 | 0.43 | 1090 | – | |
| Llama 3.2 3B (`llama3.2-3b`) | 2.02 GB | Llama 3.2 community (restrictive) | 8/151 | 42.4% | 458 / 2871 | 75 | 0.53 | 2584 | – | |
| Granite 4.0 H 350M (`granite4.0-350m`) | 0.22 GB | Apache-2.0 | 7/150 | 26.7% | 186 / 1270 | 33 | 0.33 | 482 | – | |
| Granite 4.0 1B (`granite4.0-1b`) | 1.02 GB | Apache-2.0 | 0/0 | – | 1347 / 4826 | 47 | 0.32 | 2558 | – | |
| Granite 4.2 3B (`granite4.2-3b`) | 2.24 GB | Apache-2.0 | 3/151 | 24.5% | 516 / 3204 | 88 | 0.43 | 2635 | – | |
| Gemma 3 270M (`gemma3-270m`) | 0.25 GB | Gemma terms (restrictive) | 137/144 | 4.2% | 506 / 904 | 17 | 0.53 | 683 | – | |

- **Granite 4.0 1B** produced only `!` characters on every clip with this Metal build, so its row is not a
  result. Its 1.3 s p50 is the cost of generating a full-length degenerate reply.
- **Gemma 3 270M** failed the guard on 137 of 151 clips (119 echoes, 14 dropped names, 4 too long, 7 empty drafts not asked), so it cannot clean.
- The VM column stays empty until the Lead says the VM is free.

## Reproduce

```sh
export DRAFTS=<oruk.csv>  MODEL_DIRS="<dir with the GGUFs> <dir with downloads>"
eval/local_cleanup_run.sh                       # all candidates -> eval/work/local-cleanup/<label>/
VARIANT=muesli eval/local_cleanup_run.sh qwen3-1.7b qwen3-4b
python3 eval/local_cleanup_report.py --candidates eval/local_cleanup_candidates.json \
    --runs eval/work/local-cleanup
```

Each run writes `results.csv` (harness format for the bench judge) and `summary.json` under `eval/work/`
(git-ignored). Candidates, repos, files and SHA-256: `eval/local_cleanup_candidates.json`.

## Not done yet

Judge columns and the VM (8 GB, 4 cores) repeat for the top 3.
