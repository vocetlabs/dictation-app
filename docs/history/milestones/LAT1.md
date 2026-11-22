# LAT1: faster, steadier cloud cleanup (0.2.0)

Owner, 2026-11-22. The REL2 VM run (vocet-cloud-mac-vm, release build of 2044730) missed the cloud speed
gates: key-up → paste p50 2.09 s, p95 4.27 s (gates 2.0 / 3.5). In 21 of 150 dictations cleanup passed
its 1.5 s deadline, and Vocet pasted the raw text.

The Lead joined Vocet's log with the owner's OpenRouter activity export (150 requests) and a re-send test
(126 calls). Findings:

- OpenRouter spread GLM 5.3 Flash over 19 hosts.
- The timeouts came from the host each request landed on, not from text length. InferenceNet and
  CoreWeave had 1 timeout in 41 requests; the other hosts had 20 in 109.
- Network plus OpenRouter overhead is about 0.17 s per call.

The owner keeps the 1.5 s deadline (speed first) and leaves hedging for later.

## Acceptance criteria

1. `[auto]` The cleanup request asks OpenRouter for hosts in the order `inference-net`, `together`,
   `coreweave`, with `allow_fallbacks: true`. The privacy filter stays as it is (`zdr: true`,
   `data_collection: "deny"`). The order lives in one constant next to `CLEANUP_MODEL`, with a comment
   giving the date and evidence. A unit test pins the request body.
2. `[auto]` The HTTP connection to OpenRouter is opened (or kept warm) when the dictation key goes down,
   so the speech and cleanup calls after key-up reuse it. This is a best-effort warm-up: a failure is
   ignored, it adds no visible delay, and it sends no audio or text. A test shows a warm-up at key-down
   and no second TLS handshake for the calls (or the closest testable equivalent; explain in the PR).
3. `[auto]` The cleanup log line at info level gains `provider="<host name>"`, taken from OpenRouter's
   reply, when there is one. It records the host only: never text, lengths at info level, or keys.
   A test covers the reply with a provider name and the reply without one.
4. `[auto]` `dictation_core::cleanup::TIMEOUT` stays at 1.5 s. Hedging is not built.
5. `[manual]` The Lead reruns the REL2 cloud bench in dictation-vm-bench on the merged build (151 clips,
   timed). The Lead reports p50/p95 against the gates, cleanup outcomes, and timeouts by host from the
   new log field.

## Out of scope

Hedged or parallel requests; a different speech model; local cleanup; deadline changes.

## LAT1b (2026-11-22): order changed

The Lead's offline replay (151 saved gpt-4o-mini drafts, the app's request pinned to one host, Claude
as judge) found Together and CoreWeave better than InferenceNet on cleanup quality, with similar speed.
Together: p50 0.66 s, 7.3% over 1.5 s, ZER 86.1 (83.4 with the deadline). CoreWeave: 0.74 s, 7.3%,
86.1 (82.8). InferenceNet: 0.69 s, 4.6%, 82.1 (80.8). Fireworks was over 1.5 s for 50% of requests; Z.AI
refused the zdr filter. The order is now `together`, `coreweave`, `inference-net`; `allow_fallbacks` and
the privacy filter are unchanged.
