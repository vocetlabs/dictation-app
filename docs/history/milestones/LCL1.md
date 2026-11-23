# LCL1: screen small on-device cleanup models (owner: now, alongside 0.2.0)

**Why.** In the REL2 VM run, local cleanup (Gemma 4 E2B) missed its 4 s budget on 108 of 151
dictations. Gemma 4 E2B is the only small cleanup model we have tried. The goal is a local cleaner with
Gemma's quality (OrukQwen + Gemma v3: 76.8 / 74.2 ZER) that is faster and smaller. If none qualifies, the
result decides whether local cleanup stays on by default (owner decision).

**Owner decisions, 2026-11-22.**
- Run it now.
- Restrictive licences may be tested (Llama, Gemma terms) and are flagged in the report; shipping them is
  a separate decision.
- Apple's on-device model is parked until after 0.2.0.
- Generate outputs first. Judging (Pro plan via `claude -p`, or Opus 5.5 batch on OpenRouter) is decided
  after the outputs exist, so this milestone ends with outputs and timing, not scores.
- Timing runs on the owner's Mac with plain CLI calls (llama.cpp), no screen control. It must stay light:
  the owner will be using the Mac.

## Acceptance criteria

1. `[auto]` A candidate list, each entry with a llama.cpp Q4_K_M GGUF source (exact repo and file, SHA-256
   recorded), size and licence. Start from: Gemma 4 E2B (baseline), Qwen 3 0.6B / 1.7B / 4B, a smaller
   Gemma (e.g. Gemma 3 1B or a smaller Gemma 4 variant), Phi-4 mini, Llama 3.2 1B / 3B, and a small Granite.
   Drop any candidate that has no GGUF and record why.
2. `[auto]` Inputs: the 151 raw OrukQwen 1.7B drafts of the Voice Arena set. Reuse the ones from the ASR
   screen if they are still on disk (find them). Otherwise regenerate them with Vocet's transcribe path
   and record how. The drafts stay local and git-ignored; never commit text.
3. `[auto]` Every candidate cleans all 151 drafts with the app's request: prompt v3
   (`crates/core/prompts/` or the Q4 prompt), greedy sampling, the app's `max_tokens` rule
   (`crates/core/src/local_cleanup.rs`) and the app's guard (port or reuse `guard.py`). It runs through
   llama.cpp `llama-server` with Metal, the same engine and chat template handling Vocet uses. Outputs go
   to local, git-ignored files in the format the bench judge reads.
4. `[auto]` Timing on the owner's Mac, light on the machine:
   - one model loaded at a time, one request at a time, and no parallel builds or VMs during timed runs;
   - record per clip the cleanup time (first token, total) plus load time and peak memory per model;
   - log the load average at start and end;
   - if the Mac is busy (load above 4), pause and retry later.

   Then repeat timing for the top 3 in dictation-vm-bench (8 GB, 4 cores) as the worst case, only when the
   Lead says the VM is free.
5. `[auto]` A prompt variant for the top 2 by guard pass rate: Muesli's framing (rules in the user turn,
   `<USER-INPUT>` wrapper), with outputs kept separately.
6. `[auto]` `eval/reports/local-cleanup.md`, numbers only:
   - per model: size, licence, guard fallbacks, changed share, cleanup time p50 / p95 on the host (and in
     the VM for the top 3), load time and memory;
   - judge columns left empty until judging is decided;
   - the exact commands to reproduce the run.
7. `[auto]` Downloaded models are deleted after the run (record the SHA-256 first).

**Decision rules (fixed before results).** A candidate qualifies if all of these hold:
- ZER is within 2 points of Gemma 4 E2B or better;
- cleanup p50 is under about 1 s on the host;
- OrukQwen + cleaner fit an 8 GB Mac by peak memory;
- the licence is OK to ship.

The smallest qualifying model wins.

Out of scope: app changes (a follow-up milestone if a model wins), Apple Foundation Models, and cloud models.
