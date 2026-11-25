# MCLN1 review, round 1

PR: #383 at b832df8c53dcc1f34412138817ae0e24e95c5c53
Verdict: APPROVED

## Findings

No blocker, major or minor findings.

## Checklist

1. Scope: OK. Criteria 1–5 map to the prompt, guard and mirrored tests. The
   Lead explicitly accepted the unchanged echo check refusing the bare prompt
   example "30 copies"; this is not a finding. Criteria 6–7 remain Lead checks.
2. Correctness: OK. The nine specified cues, whole-word boundaries, 30-character
   slice, every matched occurrence, ordinal suffixes and thousands separators
   follow the supplied offline rule. Links remain strict. Check order remains
   empty, echo, length, number, link, name. No concurrency or lifecycle changes.
3. Security and privacy: OK. No logging added, no transcript text introduced in
   logging, and no key, network, capability, clipboard or audio changes. Test
   inputs are synthetic; evaluation datasets are not added.
4. Architecture: OK. Pure core logic, no new dependency, OS conditional or unsafe
   code. The existing pipeline uses the same judge for local and cloud cleanup.
5. Rust and TypeScript practice: OK. Private helpers have explanatory comments;
   no new panic, unwrap, suppression or blocking I/O in product code. No TS change.
6. Licences and reuse: OK. The supplied project-owned offline rule is ported;
   existing attribution is retained and no dependency is added.
7. Tests: OK. Core suite: 271 passed. Offline unittest suite: 72 run, OK with
   one skip (optional dependency); existing resource warnings did not fail tests.
   Additional temporary review harness: 4,550 synthetic Rust/Python comparisons,
   zero mismatches, covering all cues, non-cue word extensions, offsets 0–34,
   repeated values, names, decimals, ordinals and thousands commas. This does not
   claim exhaustive Unicode equivalence. Coverage and full gate remain CI checks.
8. Git and PR: OK. Two Conventional Commits include tests with code; PR notes
   cover criteria, validation, risks and reuse. The milestone file is the Lead's
   supplied specification. No protected guard changes. No untracked minor debt.

## Additional verification and remaining checks

`cmp` confirms `crates/core/prompts/cleanup.txt` is byte-identical to
`/Users/gauri/vocet-screens/u9/cln1-prompt-v7.txt` (pinned SHA-256
`b4172ea66605dcb1bb619b88a67055f7f26e94c504d042f88174835a75bd5314`).
The local prompt diff adds only the three requested filler sounds; its hash test
passes. The Python correction matcher agrees structurally with the supplied
`cln1-guard-relaxed.py`; Rust implements its matching without a regex dependency.

No paid evaluation or VM interaction was performed in this review. The Lead's
replay/cancellation evidence, required CI, Tester result and subsequent merged-SHA
VM e2e remain their respective workflow steps. This review does not authorize a
merge; the dispatch explicitly says not to merge.
