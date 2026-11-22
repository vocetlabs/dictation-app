# LAT4: one cleanup deadline, 3 s, for cloud and local

Owner, 2026-11-22: 12 s for local is too long. Cloud and local should use the same number: 3 s.

**Evidence.**
- Gemma 4 E2B on the owner's M4 Pro (LCL1, 151 drafts): the slowest cleanup took 2.80 s, and none took
  more than 3 s.
- Cloud GLM on Together: the slowest was 2.66 s in the offline replay, and the live p95 was 1.33 s.

Voice Arena tests on MacBook Air M5 16 GB. Slower Macs paste raw text a little more often; that is tracked
in #374.

## Acceptance criteria

1. `[auto]` One shared cleanup deadline constant, 3 s, used by both the cloud cleaner and the on-device
   cleaner. Remove the separate local TIMEOUT (12 s, LAT3) and point every user at the shared constant
   (pipeline, helper, tests). The comment cites the evidence and the owner decision.
2. `[auto]` Tests pin 3 s for both paths, including one that would fail if the local path used a different
   value. The existing cloud e2e bounds (2.9–4.5 s) stay.
3. `[auto]` Docs (`docs/ENGINEERING.md`, `docs/privacy.md` if mentioned) describe one 3 s deadline.
4. `[manual]` The owner runs the local timed bench on their Mac with the merged build. The Lead reports.

Out of scope: adaptive budgets (#374).
