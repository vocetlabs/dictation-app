# MTOS1 test report, run 1

PR: #352 at 725844b (first pass started on 47a3155; re-checked on 725844b)
Result: FAIL (one scope item, the permission-to-front fix, does not work on a real Mac per the owner; everything else passes)

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Gate; unit tests: terms date stored, no analytics before it, size is the sum, grant activates window | `scripts/gate.sh`; `onboarding::tests::tos1_*`, `usage::tests::setup::tos1_*`, `modelRow.test.ts`, `Onboarding.test.tsx` | PASS | Gate passed on 47a3155 and on 725844b. |
| 1b | Nothing to analytics before Get started (app log in the VM) | e2e_onboarding_first_run app log | PASS (weak) | The app log has no telemetry or usage lines at all (the adapters log nothing at info), so absence is consistent but the unit tests are the real proof. |
| 2 | Four steps, no Ready | e2e_onboarding_first_run, e2e_onboarding_four_steps | PASS | Welcome, Speech, Permissions, Try it; Done hides the window and logs onboarding finished. |
| 2b | Done applies the launch-at-login box | e2e_onboarding_four_steps ("clear Open Vocet when I log in", Done); e2e_launch_at_login | PASS | Box on by default; the round-trip was also seen in e2e_launch_at_login. |
| 2c | Settings → Privacy still turns reports off | unit tests (`sharing_switch` etc.) | PASS | Not driven in the VM. |
| 3 | "On this Mac" card shows about 4.4 GB from the catalog | e2e_onboarding_first_run "the local model shows the whole download"; `modelRow.test.ts` | PASS | Sum of 1,319,830,656 + 3,106,738,272 B. |
| 4 | Connect screen not connected: one button, "Paste a key instead" | e2e_onboarding_first_run | PASS | Also "nothing to disconnect, re-add or credit before connecting". |
| 4b | Connected: ✓, key hint, Add credits, Continue; no Connect again / paste | e2e_onboarding_first_run ("Add credits is the one link once connected", "Paste a key instead is gone"), e2e_connect_openrouter | PASS | |
| 5 | OpenRouter in one sentence, no unverified price | e2e_onboarding_first_run | PASS | No per-hour figure (the PR says it could not be verified; the spec's example had one). |
| 6 | terms.html renders like privacy.html; footer links work | Served `site/` locally: terms, privacy, index all 200; index and privacy footers link `terms.html`; same head/meta as privacy.html; `TERMS_DATE` (2026-11-21) matches the page | PASS | Read the text; not compared pixel by pixel. |
| 7 | Claims in terms.html match 0.2.0 | Read against `crates/core/src/local_models.rs` | PASS with 1 minor | See "Failures" (minor). Branch version is still 0.1.0; the page says "0.2.0 and later". |
| 8 | Permission to front in the VM | not run | NOT TESTED in the VM | The VM image has both permissions pre-granted; revoking and re-granting through System Settings with setup open was not scriptable inside the time box. Unit-tested only. **The owner reports the app still goes behind System Settings after granting permissions on a real Mac, so this scope item does not work.** |

## Gate
`scripts/gate.sh`: all checks passed on 47a3155 and again on 725844b.

## E2E (dictation-vm; dictation-vm-2 was in use)
Full run on 725844b, `--exclude e2e_real_openrouter --exclude e2e_real_mic`:
- 34 scenarios PASS, 2 FAIL (`e2e_onboarding_four_steps`, `e2e_connect_openrouter`). Both **passed when re-run alone** on the same build (2 passed, 0 failed), so they are flaky in the long run: the Speech step or download strip was not found in time (VM load). Not product failures, but worth a look for timing margins.
- `e2e_local_model` did not finish: it downloads the real 4.4 GB (speech + cleanup) from Hugging Face and was still waiting (looks every 60 s, deadline 50 min) when I stopped it after more than 10 minutes, twice (first run on 47a3155 also stopped there at the 30-min limit of my background command). Not run to completion by me; the Developer reported it green.
- The six scenarios after it in the list (`e2e_cleanup_applied`, `e2e_cleanup_deadline`, `e2e_first_paste_after_launch`, `e2e_quit_right_after_paste`, `e2e_history`, `e2e_update_privileged_install`) were run separately: 6 passed, 0 failed.
- Not run: `e2e_real_openrouter`, `e2e_real_mic` (excluded), `e2e_release_build_smoke` and `e2e_notarized_dmg_first_launch` (optional, not in the run).

## Untested behaviour found
- Real permission grant bringing setup to the front (see 8). Needs a real Mac or a scripted System Settings grant.
- Settings → Privacy off-switch has no VM scenario (unit tests only).

## Failures
- **Scope item 5 (important):** after allowing Microphone and Accessibility the setup window still stays behind System Settings on a real Mac (owner, 2026-11-21). The unit test checks the trigger, not that the window actually comes to the front.
- Minor: `terms.html` says Gemma comes under "Google's Gemma terms", but the catalogue (`local_models.rs`) lists Gemma 4 E2B as "Apache-2.0 (Google)". One of the two is wrong; check the model card.
- Minor: the e2e flakiness above in `e2e_onboarding_four_steps` and `e2e_connect_openrouter` in a full run.
