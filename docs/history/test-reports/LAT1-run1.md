# MLAT1 test report, run 1

PR: #365 at 8f4bbf68 (later head 99b92ce9 adds only the review doc)
Result: FAIL

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Provider order inference-net, together, coreweave; `allow_fallbacks: true`; zdr / data_collection unchanged; constant beside `CLEANUP_MODEL` with date + evidence | `crates/transcribe/src/cleanup.rs` request-body test pins the whole `provider` object; `CLEANUP_PROVIDER_ORDER` in `cloud_models.rs` | PASS | Read in code and test. |
| 2 | Warm-up at key-down; no key/audio/text; failure ignored; connection reused | `crates/transcribe/tests/lat1_warm_up.rs` (counting server: 1 connection for HEAD + POST; HEAD has no authorization header); `cleanup_log.rs` (one warm-up per key-down) | PASS in unit/integration; **FAIL in VM e2e** | Code: bodiless `HEAD` with `CONNECT_TIMEOUT`, result discarded; spawned task, no delay. Speech and cleanup share one client. But see Failures. |
| 3 | Info line has `provider="<host>"`, no text | `lat1_the_cleanup_line_names_the_host_and_key_down_warms_up`; `the_reply_names_its_host_when_it_has_one` | PASS | Named reply logs `provider="InferenceNet"`; unnamed reply has no field. VM log (fake provider names no host): `cleanup outcome="applied" duration_ms=9`. |
| 4 | `cleanup::TIMEOUT` stays 1.5 s | `crates/core/src/cleanup.rs` asserts 1_500 ms | PASS | Unchanged in the diff; no hedging code. |

## Gate
`scripts/gate.sh`: pass on the second run. The first run failed two
`llama::tests` (`the helper didn't start`, 10.9 s) while the Mac was under
load (load average ~6.5); both pass alone and in the rerun. Flake, not LAT1.
Coverage was inside the gate and passed.

## VM e2e (dictation-vm-2, fake provider)
- `e2e_cleanup_applied`: PASS
- `e2e_cleanup_deadline`: PASS
- `e2e_connect_openrouter`: **FAIL** (run twice)
- Also failing from the same cause: `e2e_onboarding_first_run`,
  `e2e_settings_key_provider_recovery`, `e2e_quit_during_transcription_then_relaunch`.

## Untested behaviour found
No test covers the warm-up against the e2e fake provider; that gap is the
failure below. Not added: the fix belongs in the fake (product-side numbering
choice), which the Developer should make.

## Failures
Cause: the key-down warm-up `HEAD https://.../chat/completions` reaches the
fake provider (`tests/e2e/fixtures/local-provider.pl`), which logs it as
`request n=<n> path=/v1/chat/completions auth=none ...` and answers 404. That
consumes a request number per dictation, so every scenario that asserts by
number breaks.

Reproduce: `E2E_VM=dictation-vm-2 tests/e2e/run.sh e2e_connect_openrouter`.
- Expected: `request 1` is the speech call with `auth=good`.
- Actual: `request n=1 path=/v1/chat/completions auth=none` (the HEAD), speech
  is n=2, so "the fake saw the connected key" fails and the later
  `replied n=2 status=402` never matches (the 402 is n=4).
- Other scenarios: `e2e_onboarding_first_run` (expects n=3), 
  `e2e_settings_key_provider_recovery` (n=1, 3, 5 and "five requests in all"),
  `e2e_quit_during_transcription_then_relaunch` (`replied n=1 status=200`,
  "two requests in all").

Suggested fix (Developer): make the fake answer `HEAD` without counting or
logging it as a numbered request (or log it as a separate `warm` event), and
add an e2e check that a dictation sends a keyless `HEAD` first. The warm-up
also confirms in the VM that it carries no key (`auth=none`).
