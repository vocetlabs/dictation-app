# LCL1: small on-device cleanup models, screen (outputs and timing)

Numbers only. 2026-11-22, M4 Pro 24 GB, macOS 15, llama.cpp
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
  no system turn. Run for the top 2 by guard pass rate among working models, Qwen3 1.7B and Qwen3 4B, and later, at the
  owner's request, for the Gemma 4 E2B baseline (run at `nice -n 19` while a VM bench ran; load average 3.7 to 3.9).
- **Models:** each GGUF's SHA-256 equals the Hugging Face LFS id of the repo and file below. Eight were
  already on disk (`~/vocet-cleanup-models`, left alone). Llama 3.2 1B, the two Granite 4.0 files and Gemma 3 270M
  were downloaded; the table after the results lists them and that each was deleted after the run. Nothing was dropped for lacking a GGUF. Gemma 4 E2B is the smallest
  Gemma 4, so Gemma 3 1B is the smaller Gemma. Gemma 3 270M (`unsloth/gemma-3-270m-it-GGUF`) was run after disk space was freed.

## Results

Every run asked all 151 clips: no draft was blank (skipped) and no request failed. Guard fallbacks are replies the
guard refused, so the raw text is pasted; blank replies (the model answered with nothing the guard could use)
are counted in them and shown separately. Changed is the share of drafts whose pasted text differs from the raw
text. Times are the cleanup request, in ms, over the 151 requests.

| Model (label) | Size | Licence | Guard fallbacks of asked (blank replies, failed requests) | Changed | Cleanup p50 / p95 (ms) | First token p50 (ms) | Load (s) | Peak RSS (MB) | Judge ZER (AMEND) |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemma 4 E2B (baseline) (`gemma4-e2b`) | 3.11 GB | Apache-2.0 | 5/151 (0 blank, 0 failed) | 50.3% | 387 / 2438 | 40 | 0.64 | 3425 | 72.2 (0.62) |
| Gemma 4 E2B (baseline) (Muesli framing) (`gemma4-e2b-muesli`) | 3.11 GB | Apache-2.0 | 4/151 (0 blank, 0 failed) | 49.7% | 411 / 2468 | 49 | 0.94 | 3255 | 68.9 (0.75) |
| Qwen3 0.6B (`qwen3-0.6b`) | 0.40 GB | Apache-2.0 | 3/151 (0 blank, 0 failed) | 28.5% | 161 / 982 | 22 | 0.33 | 1014 | 55.6 (3.25) |
| Qwen3 1.7B (`qwen3-1.7b`) | 1.11 GB | Apache-2.0 | 0/151 (0 blank, 0 failed) | 16.6% | 287 / 1795 | 44 | 0.43 | 1690 | 58.3 (1.3) |
| Qwen3 1.7B (Muesli framing) (`qwen3-1.7b-muesli`) | 1.11 GB | Apache-2.0 | 0/151 (0 blank, 0 failed) | 10.6% | 319 / 1940 | 58 | 0.44 | 1690 | – |
| Qwen3 4B (`qwen3-4b`) | 2.50 GB | Apache-2.0 | 2/151 (0 blank, 0 failed) | 25.2% | 579 / 3678 | 104 | 0.54 | 3152 | – |
| Qwen3 4B (Muesli framing) (`qwen3-4b-muesli`) | 2.50 GB | Apache-2.0 | 2/151 (0 blank, 0 failed) | 36.4% | 648 / 3781 | 147 | 0.54 | 3152 | 69.5 (0.89) |
| Gemma 3 1B (`gemma3-1b`) | 0.81 GB | Gemma terms (restrictive) | 8/151 (0 blank, 0 failed) | 37.8% | 250 / 1474 | 38 | 0.43 | 1073 | 53.6 (5.17) |
| Phi-4 mini 3.8B (`phi4-mini`) | 2.49 GB | MIT | 4/151 (0 blank, 0 failed) | 38.4% | 534 / 3263 | 85 | 0.54 | 3106 | 62.9 (0.94) |
| Llama 3.2 1B (`llama3.2-1b`) | 0.81 GB | Llama 3.2 community (restrictive) | 17/151 (0 blank, 0 failed) | 50.3% | 205 / 1232 | 31 | 0.43 | 1090 | – |
| Llama 3.2 3B (`llama3.2-3b`) | 2.02 GB | Llama 3.2 community (restrictive) | 8/151 (0 blank, 0 failed) | 42.4% | 458 / 2871 | 75 | 0.53 | 2584 | – |
| Granite 4.0 H 350M (`granite4.0-350m`) | 0.22 GB | Apache-2.0 | 8/151 (1 blank, 0 failed) | 26.5% | 186 / 1270 | 33 | 0.33 | 482 | – |
| Granite 4.0 1B (`granite4.0-1b`) | 1.02 GB | Apache-2.0 | 151/151 (151 blank, 0 failed) | 0.0% | 1347 / 4826 | 47 | 0.32 | 2558 | – |
| Granite 4.2 3B (`granite4.2-3b`) | 2.24 GB | Apache-2.0 | 3/151 (0 blank, 0 failed) | 24.5% | 516 / 3204 | 88 | 0.43 | 2635 | – |
| Gemma 3 270M (`gemma3-270m`) | 0.25 GB | Gemma terms (restrictive) | 144/151 (7 blank, 0 failed) | 4.0% | 506 / 904 | 17 | 0.53 | 683 | – |

| Downloaded for LCL1 | SHA-256 (checked before each run) | Deleted after the run |
| --- | --- | --- |
| `Llama-3.2-1B-Instruct-Q4_K_M.gguf` | `6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83` | yes |
| `granite-4.0-h-350m-Q4_K_M.gguf` | `0a8d6a7373602fadfba274a640ba784b86cc6847f1c67f1b0a90fa2ec266b7fb` | yes |
| `granite-4.0-1b-Q4_K_M.gguf` | `22ec0f9cc99a90185312de3c882c84e7bd6789bdd050389844380a01a831d7f1` | yes |
| `gemma-3-270m-it-Q4_K_M.gguf` | `b1baabd6b729e4041822220d3e648e00d99cac5df86b10dffb77bcccf0688e39` | yes |

Skipped (blank) drafts across the runs: 0.

- **Granite 4.0 1B** answered every request (151 blank replies, no request failed) but with only `!` characters
  under this Metal build, so the guard refused all 151 and its row is not a result. Its 1.3 s p50 is the cost of
  generating a full-length degenerate reply.
- **Gemma 3 270M** failed the guard on 144 of 151 clips (119 echoes, 14 dropped names, 4 too long, 7 blank
  replies), so it cannot clean.
- **Judge:** Claude Opus 5.5 through `claude -p` on the Pro plan, all 151 clips; ZER is the share of drafts
  judged sendable, AMEND the character edits over characters. Run dirs: `dictation-bench/out/lcl1-<label>`.
  Gemma 4 E2B with Muesli framing against the app framing, paired: 1 clip better, 6 worse. Not judged: Qwen3 4B
  (app framing), Qwen3 1.7B Muesli, Llama 3.2 1B and 3B, Granite 4.2 3B, Granite 4.0 350M, Gemma 3 270M and
  Granite 4.0 1B (the last two are unusable). The owner's real-Mac REL2 run of Gemma 4 E2B scored 72.2, the
  same as the offline figure.
- **VM timing dropped:** the 8 GB VM repeat for the top 3 was not run (decision: local cleanup is measured on a
  real Mac only).

## Reproduce

```sh
export DRAFTS=<oruk.csv>
eval/local_cleanup_run.sh -d "<dir with the GGUFs>" -d "<dir with downloads>"   # all candidates
VARIANT=muesli eval/local_cleanup_run.sh -d "<dir>" qwen3-1.7b qwen3-4b gemma4-e2b
python3 eval/local_cleanup_report.py --candidates eval/local_cleanup_candidates.json \
    --runs eval/work/local-cleanup
```

Each run writes `results.csv` (harness format for the bench judge) and `summary.json` under `eval/work/local-cleanup/<label>/`
(git-ignored, a private 0700 directory; labels may use only letters, digits, `.`, `_`, `-`). Candidates, repos, files and SHA-256: `eval/local_cleanup_candidates.json`.

## Conclusion

**Among the judged models none qualifies; keep Gemma 4 E2B with the app's prompt.** Gemma 4 E2B scores 72.2 ZER
(AMEND 0.62). The closest judged alternatives are Qwen3 4B with Muesli framing at 69.5 (0.89), at 648 ms p50
against 387 ms (1.67 times as slow), and Gemma 4 E2B with Muesli framing at 68.9 (0.75), 1 better and 6 worse
than the app framing. The faster judged models lose 14 to 19 points (Qwen3 1.7B 58.3, Qwen3 0.6B 55.6, Gemma 3
1B 53.6), and Phi-4 mini (62.9) loses 9 and is not faster. No judged model is within 2 points of Gemma 4 E2B
and under 1 s p50. The candidates that were not judged are not ruled out by scores: Granite 4.0 1B and Gemma 3
270M cannot clean, and the rest (Qwen3 4B with the app framing, Qwen3 1.7B Muesli, Llama 3.2 1B and 3B, Granite
4.2 3B, Granite 4.0 350M) have no judge score here.
