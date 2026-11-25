# MREL3 review, round 1

PR: #385 at c5dec6407d03770a82b6aa06602f794411db7934
Verdict: CHANGES REQUESTED

## Findings

| # | Severity | file:line | Finding | Suggested fix |
| - | -------- | --------- | ------- | ------------- |
| 1 | major | CHANGELOG.md:16 | The advertised exact correction from "20 copies, make that 30" to "30 copies" is rejected as a prompt echo by the shipped guard, so the pipeline falls back to the original transcript. The existing test at `crates/core/src/cleanup.rs:653` deliberately pins this exception. | Use the supported longer example "Print 20 copies, make that 30" to "Print 30 copies", and have the Lead align the exact-text REL3 spec. No product change is needed in this release PR. |

Inline finding: <https://github.com/vocetlabs/dictation-app/pull/385#discussion_r4701909706>.

## Checklist

1. Scope: OK. Version metadata, changelog, tester guide and Lead-authored
   milestone only; no application, prompt, test, dependency or guard changes.
   The changelog body matches criterion 2 exactly and has its required date.
   Finding 1 identifies an accuracy problem shared by that spec text.
2. Correctness: finding 1. All three versions checked by `scripts/release.sh`
   are 0.2.1. Both npm lock versions and all seven workspace Cargo lock
   package versions agree; other lock content is unchanged. Compare links
   point to the intended release range. Main since v0.2.0 contains CLN1 #383,
   EVAL1 #378 and website-only #380/#381. Cloud punctuation/fillers and local
   filler additions match CLN1. The cancellation description matches its
   intended guard behavior; this review does not claim exhaustive cancellation
   protection. EVAL1 is not a default feature and release builds do not enable
   it, so omitting it from user-facing release notes is appropriate.
3. Security and privacy: OK. No changed runtime behavior, capture feature,
   logging, secrets, network destinations, capabilities or clipboard handling.
4. Architecture: OK. No code or dependency changes.
5. Rust and TypeScript practice: OK. No source changes or new suppressions.
6. Licences and reuse: OK. No new dependencies or adapted code.
7. Tests: OK for metadata scope. Locked offline Cargo metadata succeeds.
   The existing exact-example echo test and accepted-correction test both
   pass, confirming finding 1 and the proposed replacement respectively.
   Release-script stub tests and the push gate are recorded below. Manual
   release validation remains the Lead's and owner's responsibility.
8. Git and PR: OK. Conventional Commits; no protected guard changes or new
   minor debt. The latest diff includes the dated heading and tester-guide
   change; the PR body's older placeholder/date and exclusion notes are stale.
   `docs/TESTERS.md` correctly updates its version summary to 0.2.1 and the
   supported weekday self-correction example. No merge performed, as dispatched.

## Validation and remaining work

Review is limited to release metadata and prose, with targeted existing tests
for the advertised behavior. The full VM e2e, live Voice Arena quality/latency
run, signing/publishing, release-page checks and 0.2.0 update check are not
performed here. Resolve finding 1 with the Lead before approval.
