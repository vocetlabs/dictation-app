# LAT2: cloud cleanup deadline 1.5 s → 3 s (score first)

Owner, 2026-11-22: "do whatever we can to get a higher score … if that means increasing timeout I am ok."

Evidence (Lead offline replay, 151 saved gpt-4o-mini drafts, the app's request pinned to Together, Claude
judge):
- ZER 86.1 with no deadline, against 83.4 at 1.5 s.
- Together's replies: p50 0.66 s, p90 1.35 s, max 2.66 s.

A 3 s deadline keeps nearly every cleanup. Typical latency barely moves; the slow tail grows.

## Acceptance criteria

1. `[auto]` `dictation_core::cleanup::TIMEOUT` (the cloud cleanup deadline) becomes 3 s. The comment cites
   this evidence and the owner decision. Tests pinning 1.5 s are updated. The local cleanup budget is
   unchanged.
2. `[auto]` Anything that depends on the old value still holds with 3 s: the overlay or "still working"
   state, the e2e fake provider's hold or deadline scenarios, and docs (`docs/ENGINEERING.md`, privacy or
   pricing text, if the value is mentioned). Grep for 1.5 / 1500 / 1_500 near cleanup.
3. `[auto]` `e2e_cleanup_deadline` (fake provider holds the reply) still shows the raw text being pasted
   after the deadline, now at about 3 s, and adds no other wait.
4. `[manual]` The Lead reruns the REL2 cloud bench on the merged build and reports ZER, p50 and p95.

Out of scope: hedging, model changes, the guard.
