# MTOS1 review, round 3

PR: #352 at 4a2bec8accaf7a6fcce320c76b6bbccd5a39d383
Verdict: CHANGES REQUESTED

Reviewed only `git diff 725844b HEAD`, including the owner's walkthrough changes and the round 3 fixes.

## Findings

| # | Severity | file:line | Finding | Suggested fix |
| - | -------- | --------- | ------- | ------------- |
| 1 | blocker | src-tauri/src/commands.rs:617 | Closing setup does not stop the new permission watcher from activating it. The title-bar close handler (`lib.rs:297-302`) records `setup_left` and hides the window; that telemetry helper never closes the onboarding state. Its view remains `Onboarding`, so a subsequent permission grant calls `read_onboarding` and reopens the dismissed window, stealing focus. | Track whether setup is explicitly open, suspend grant activation after close, and retain resume behavior. Cover close-then-grant and reopening setup in a regression test; ensure a close cannot be undone by an activation queued just before it. |

[Inline finding](https://github.com/gargankit90/dictation-app/pull/352#discussion_r4655109574).

Concrete path: open Permissions with a permission missing, open System Settings, close setup using its title-bar button, return to System Settings and grant the permission. The thread still sees the onboarding view and brings the hidden setup window forward. This is established by the close/state/activation paths; I did not drive this sequence in a VM.

## Checklist

1. Scope: finding 1. Terms now sit directly below the demo; Speech cards have the requested pros/cons; connected setup has credit/Add credits and no key hint; Settings has separate connected/disconnected states; paste fallback waits for trouble; download size uses GB; tray shows combined percentage. Unverified prices were removed. These follow the owner's round 3 directions, which supersede the original layout examples.
2. Correctness: finding 1. The watcher sleeps one second on every iteration, including absent-state and non-setup paths: no busy loop. It is one process-lifetime thread, rather than a per-window thread; outside the onboarding view it skips permission reads, but explicit window close does not change that view. The atomic grant consumption prevents duplicate consumption by UI and watcher. Credits are optional, independently requested, and never gate Continue; failures yield no initial amount, and failed refresh retains the previous amount.
3. Security and privacy: OK within this diff. Saved key read remains in Rust/keychain. Credits use the provider base URL, production OpenRouter or the existing debug loopback fake; the shared HTTP client rejects redirects. Key travels only in Authorization, with no key/body logging. The two requests run together under a two-second overall network timeout; keychain retrieval precedes that network budget. Only numeric balances return to the UI. Privacy text discloses the lookup; capabilities and typed bindings updated together. No new telemetry fields, audio handling or clipboard changes.
4. Architecture: OK. Credits live in transcribe, tray formatting in app, shell wiring in Tauri. No new dependencies, unsafe blocks or platform cfg changes.
5. Rust and TypeScript practice: OK apart from finding 1's lifecycle behavior. No new panic shortcuts; numeric cast suppression has its clamp rationale; asynchronous network lookup does not block the UI thread or audio callback.
6. Licences and reuse: OK. The exact pinned Gemma GGUF README reports `license: apache-2.0`, consistent with the catalogue and corrected Terms: [pinned model metadata](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/blob/0314792d7f1f7e229411f620751375812bb9faf2/README.md). Retrieved the raw README directly for verification. No copied code or dependency changes in this round.
7. Tests: finding 1 lacks close-then-grant coverage. Focused UI, credits and TOS1 tests pass. Credits tests cover normal balance, limited key, management-endpoint refusal, invalid key, malformed/error response, overspending and timeout. New VM scenario checks a covered setup regains focus after a microphone grant, but does not dismiss setup before the grant. Existing unit coverage checks the Settings view, not the actual title-bar close path. Developer reports before/after VM evidence and repeated onboarding passes; not independently rerun here. Accessibility grant and owner walkthrough remain manual evidence.
8. Git and PR: OK. Conventional commits, detailed round 3 notes, no guard/spec edits in this diff. No new minors; no tech-debt issues needed. No merge performed.

## Validation

- `npx vitest run src/Onboarding.test.tsx src/Settings.test.tsx src/settings/modelRow.test.ts`: 164 passed.
- `cargo test -p dictation-transcribe credits:: --lib`: 7 passed.
- `cargo test -p dictation-app tos1 --lib`: 7 passed, including prior failed-consent-write regression.
- `cargo test -p dictation-pipeline tray:: --lib`: 32 passed.
- Full gate is reported green by the Developer on this product head; report commit also runs the normal pre-push gate.
