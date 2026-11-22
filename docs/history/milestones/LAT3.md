# LAT3: local cleanup budget 4 s → 12 s (score first)

Owner, 2026-11-22: optimise for the Voice Arena score now, and revisit for user experience later (issue
filed).

Voice Arena's harness keeps listening 4 s after a clip, then waits until the text has been unchanged for 2 s,
up to 30 s (methodology PDF §4.1–4.2). Speed is not part of ZER. In the REL2 VM run, local cleanup (Gemma 4
E2B) passed its 4 s budget on 108 of 151 clips, so most local drafts were raw OrukQwen. Offline, Gemma lifts
OrukQwen from about 59 to 72 ZER. Cloud stays at 3 s (LAT2; owner: good for users too).

## Acceptance criteria

1. `[auto]` The on-device cleanup budget becomes 12 s. Find where the 4 s lives: the local cleaner, the
   pipeline deadline, or the llama-server request timeout. Every layer that would cut a reply off before
   12 s moves with it, including the helper's HTTP timeout and any max_tokens- or time-based limits. The
   comment cites this evidence and the owner decision. Tests pinning 4 s are updated. The cloud deadline
   (3 s) is unchanged.
2. `[auto]` The overlay or "still working" state behaves sensibly for a wait of up to 12 s: no error state,
   and the existing transcribing indicator stays up. Docs mentioning the 4 s budget are updated.
3. `[auto]` The local cleanup deadline e2e (if one exists) covers the new bound, with a lower bound so 4 s
   would fail, as in LAT2.
4. `[manual]` The Lead measures local in dictation-vm-bench resized to 8 CPUs and 16 GB, plus judging.

Out of scope: model or prompt changes; the cloud deadline.
