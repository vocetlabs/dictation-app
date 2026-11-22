# MLAT1 review, round 1

PR: #365 at 8f4bbf6839c75d8e50d14d37e5d9e4c080f0d497
Verdict: APPROVED

## Findings

No blocker or major findings. Existing test debt confirmed and filed as
[issue #366](https://github.com/vocetlabs/dictation-app/issues/366), splitting out the OpenRouter item in #344.

## Checklist

1. Scope: OK. Criteria 1–4 map to implementation and tests; criterion 5 remains the Lead's merged-build bench. The dependency security update is justified gate maintenance.
2. Correctness: OK. Key-down spawns a separate warm-up task without awaiting it. HEAD has no body or authorization, errors are discarded, and the request is bounded to ten seconds. Dropping its future cancels it; a cancelled dictation can leave this harmless bounded warm-up running. Speech and cleanup use clones of the same pooled Client. No retry or hedge was added to cleanup; its 1.5 s deadline remains unchanged.
3. Security and privacy: OK. The routing object retains `zdr: true` and `data_collection: "deny"` alongside the ordered slugs and fallbacks; no unfiltered retry exists. The info event adds only the optional reply provider, retaining outcome and duration; text and character counts stay out of info logs. Warm-up uses the existing provider endpoint with redirects disabled. No new capabilities, telemetry or storage.
4. Architecture: OK. Port defaults preserve existing cleaners; delegation through Engine, Transcribers and AppCleaner retains host metadata. Local cleanup still returns no cloud host and does not warm the cloud connection. No new dependency direction, unsafe block or platform conditional.
5. Rust and TypeScript practice: OK. No new production panic, blocking wait or suppression. Public additions have documentation; no TypeScript changes.
6. Licences and reuse: OK. No copied code or new dependency. The url/form_urlencoded patch updates and regenerated version labels are small; the remaining lock change resolves cssparser-macros to the already-present syn 2.0.119. `cargo deny check advisories licenses` and `scripts/check-licences.sh` pass.
7. Tests: OK. Independently ran the LAT1/cleanup nextest selection (17 passed) and OpenRouter integration binary under nextest (15 passed). The counting loopback server proves warm-up/cleanup TCP pooling; inspection establishes speech uses the same Client. This is the documented offline equivalent, not a live TLS or latency measurement. Provider-present/absent parsing and info logging are covered. Plain `cargo test -p dictation-transcribe --test openrouter` independently failed on both this head and main 2044730e (14 passed, 1 failed each): missing captured events, not a demonstrated secret leak. Track deterministic subscriber/callsite isolation in #366.
8. Git and PR: OK. Conventional commits and detailed criterion/test mapping. The spec addition is a separate Lead-authored specification commit. No guards changed. No merge performed; CI, Tester verdict and the Lead's manual bench remain separate evidence.

Routing semantics checked against [OpenRouter's provider routing documentation](https://openrouter.ai/docs/guides/routing/provider-selection).
