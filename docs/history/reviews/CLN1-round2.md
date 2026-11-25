# MCLN1 review, round 2

PR: #383 at 514e33e87a76711fd6a9764110d03bc150d3ec74
Verdict: APPROVED

## Findings

No blocker, major or minor findings.

## Checklist

1. Scope: OK. Reviewed only changes since c1626aef, including the Lead's
   criterion 2b addition and the tester's criterion 3 regression cases.
2. Correctness: OK. Whole-word, case-insensitive cancel cues match the supplied
   prototype. The last two content words exclude the specified lead words;
   the no-other-deletions check consumes a multiset, preserving duplicate
   counts. Zero through twelve and curly apostrophes are normalised. A cue
   kept verbatim is exempt. The check follows all existing checks. The accepted
   deviation adds `nevermind` to exempt cue words, allowing that cue to fire.
3. Security and privacy: OK. The existing pipeline accepts only `Accepted`;
   every refused verdict returns no replacement and retains the raw transcript.
   Debug logging uses `refused.name()` only; usage telemetry remains the closed
   `FallbackGuard` outcome. No text logging, new event fields, network, key,
   clipboard, audio or capability changes.
4. Architecture: OK. Pure core helpers and the Python offline mirror; no new
   dependencies, OS conditionals, unsafe code or lifecycle changes.
5. Rust and TypeScript practice: OK. No product unwrap, panic, blocking I/O or
   new suppression. Helpers are documented. No TypeScript changes.
6. Licences and reuse: OK. Port of the supplied project-owned prototype;
   no new external code or dependencies.
7. Tests: OK. Core suite passed; Python offline suite ran 75 tests successfully
   with one optional-dependency skip and existing resource warnings. Mirrored
   tests cover all cues, lead words, number normalisation, applied cancellation,
   retained cues, boundaries and empty pre-cue content. A temporary review
   harness compared 4,212 synthetic cases: Rust versus Python full verdicts,
   and Python cancel detection versus the prototype with the accepted
   `nevermind` exemption. Zero mismatches, including repeated words, other
   deletions, cue prefixes/suffixes, casing and number words. This is not an
   exhaustive Unicode equivalence claim. Full gate and coverage remain the
   required workflow checks.
8. Git and PR: OK. Conventional Commits include mirrored tests; notes describe
   2b and the accepted prototype deviation. No protected guard edits or new
   minor debt. The pre-existing bare `30 copies` echo exception stays accepted.

## Remaining workflow

No merge performed, as dispatched. Required CI, the latest Tester result,
Lead replay/manual evidence and the later merged-SHA VM e2e remain their
respective workflow steps. No paid evaluations or VM interaction in this review.
