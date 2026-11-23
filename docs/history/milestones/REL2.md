# REL2: Vocet 0.2.0 "Clean dictation"

Owner decisions, 2026-11-20. Story: dictation that comes out ready to send — with your own OpenRouter key
(default), or fully private on your Mac.

## Contents (must have)
| Milestone | What |
|---|---|
| Q1 ✅ (#335, mQ1) | Eval harness on main, regression check, key-up-to-paste latency |
| Q2 (#336) | Cleanup in the pipeline (prompt v4 + guard, 1.5 s deadline, raw fallback); OpenRouter only (gpt-4o-mini-transcribe + GLM 5.3 Flash); Groq/OpenAI removed |
| Q3 (#338) | Connect OpenRouter (OAuth PKCE) as the default first run; Add credits on 402; old key screens deleted |
| Q4 (#337) | Local option: OrukQwen 1.7B + Gemma 4 E2B (helper), chosen by the user, not the default |
| Q5 | Privacy policy matching the shipped modes (audio → OpenRouter → OpenAI, no training, logs ≤30 days; text → ZDR GLM host; local: nothing leaves the Mac) |
| SIMP1 | Simplification pass, typed user-friendly errors |
| VA1 | Voice Arena readiness (below) |

Nice to have if they don't delay: custom dictionary in the cleanup prompt; Homebrew cask.
Not in 0.2.0: Vocet Cloud, app-based styles, training on user data, non-English.

## Release gates
1. Quality (eval/ harness, full 151 public clips, end to end through the app in the VM, not offline):
   cloud ZER ≥ 85 (eval 88.1), local ≥ 75 (eval 76.8); regression check passes.
2. Speed (key-up → paste, VM and a real Mac): cloud p50 ≤ 2.0 s, p95 ≤ 5.0 s (owner 2026-11-22: was 3.5 s; the
   outliers come from OpenAI's single-host speech model and the 3 s cleanup deadline; revisit in #374);
   local p50 ≤ 1.5 s on 16 GB;
   8 GB measured and recorded.
3. Reliability: a cleanup failure never loses text (raw fallback tested); full VM e2e suite passes on the
   release commit.
4. OrukQwen hosted on the owner's Hugging Face repo; the app pinned to that exact file (SHA-256 0574716…).
5. First run (manual, Lead + owner): fresh install → Connect OpenRouter → add credits → first dictation.
6. Not a gate (owner): updating from 0.1.0. Update e2e scenarios that depend on 0.1.0 may be deleted.

## VA1: before sharing a build with Voice Arena
1. End-to-end proof: run the 151 public clips through the shipped app (VM harness from PR #323), not
   just offline cleanup; confirm the score and latency we'd claim.
2. A review build: notarized 0.2.0, auto-update off or harmless, analytics off by default for that build
   (or documented), debug mode off.
3. A capped OpenRouter key for Voice Arena (owner creates it, credit limit e.g. $10, revocable), or ask
   whether they bring their own; never a key in the binary.
4. Ask Voice Arena's requirements first: how they drive the app (hotkey, audio injection, paste capture),
   macOS version, permissions, data retention for their private test set (gpt-4o-mini-transcribe has no
   ZDR route on OpenRouter; offer the Voxtral/ZDR configuration if they require zero retention), which
   modes to list (Cloud and Private as separate entries?), and any fees or terms.
5. Freeze the evaluated configuration in the model catalog and note gpt-4o-mini-transcribe's shutdown
   (2027-02-26): tell them the planned replacement and re-evaluation.
6. Owner sends the request (outward-facing; also raise in the immigration consult).

## Results and owner decisions (2026-11-22)

- **Cloud**, VM run on e06389e (LAT1, LAT1b, LAT2, FIX364): ZER 86.8, p50 1.87 s, p95 4.34 s, 151/151 ok,
  0 cleanup timeouts, all hosts Together. All cloud gates are met.
- **Local**, owner's M4 Pro on 5071a5d (LAT4, one 3 s deadline): ZER 72.2, p50 0.90 s, p95 4.95 s, 151/151 ok,
  150 cleanups applied, 3 guard fallbacks, 0 timeouts. The speed gate is met. The quality gate (75) is missed
  by 2.8; it was set from an offline 76.8 that used a different judge setting (Claude max effort), while
  today's judge gives the same offline pipeline 72.2. **The owner accepted the local result for 0.2.0**
  ("very happy with numbers from local run").
- The local test runs on a real Mac only; the VM has no real GPU (owner decision).
- 8 GB: the VM measurement from 2026-11-21 (64.2 at the old 4 s budget) is recorded, with the caveat that the
  VM undersells real Macs. Messaging is pending an owner decision.
