//! CLN1 tester run 1: the spec's criterion 3 sentences verbatim, plus edge
//! cases for the correction rule. Synthetic text only.

use dictation_core::cleanup::{Judgement, judge, prompt};

fn j(raw: &str, reply: &str) -> Judgement {
    judge(raw, reply, prompt())
}

#[test]
fn spec_sentences_are_cleaned() {
    assert_eq!(
        j("Email Carlos, I mean Carla", "Email Carla"),
        Judgement::Accepted
    );
    assert_eq!(
        j("version 3.1, wait, no, 3.2", "version 3.2"),
        Judgement::Accepted
    );
    // Lead-accepted deviation: the bare example trips the echo check.
    assert_eq!(j("20 copies, make that 30", "30 copies"), Judgement::Echo);
}

#[test]
fn edge_cases_keep_the_strict_rules() {
    // Cue present but the name is uncorrected elsewhere: refused.
    assert_eq!(
        j(
            "Ask Carlos, I mean Carla. Carlos agreed to the plan.",
            "Ask Carla. He agreed to the plan."
        ),
        Judgement::DroppedName
    );
    // Empty and whitespace replies still fall back.
    assert_eq!(j("Pay 40, sorry, 50 today.", ""), Judgement::Empty);
    // Cue exactly past the 30 character window is refused.
    assert_eq!(
        j(
            "Order 20 copies for the whole big office now, wait, 30.",
            "Order copies for the whole big office now, 30."
        ),
        Judgement::DroppedNumber
    );
    // Unicode text next to a number does not panic.
    let _ = j("Café 9, sorry, 10 — ünï", "Café 10 — ünï");
}

/// Criterion 2b: parts of the spec the module tests don't pin.
#[test]
fn unresolved_cancel_spec_edges() {
    let fires = Judgement::UnresolvedCancel;
    let ok = Judgement::Accepted;
    // The existing checks run first: an uncorrected number is far from the cue,
    // and the reply also leaves the cancellation unresolved.
    assert_eq!(
        j(
            "Pay 40 dollars to the vendor across town. Book the blue room. Scratch that, book the red room.",
            "Pay dollars to the vendor across town. Book the blue room. Book the red room."
        ),
        Judgement::DroppedNumber
    );
    // Rule (b) covers the whole transcript: once the first cue's words are
    // dropped ("green"), a second, unapplied cue is not caught.
    assert_eq!(
        j(
            "paint it green scratch that paint it grey. call the plumber never mind call the roofer",
            "Paint it grey. Call the plumber. Call the roofer."
        ),
        ok
    );
    // Capitalised cue; number words and digits match in both directions.
    assert_eq!(
        j(
            "lunch is at 12. Scratch that lunch is at one",
            "Lunch is at twelve. Lunch is at 1."
        ),
        fires
    );
    // A curly apostrophe in the reply matches a straight one.
    assert_eq!(
        j(
            "bring Sam's laptop, forget that, bring the charger",
            "Bring Sam\u{2019}s laptop. Bring the charger."
        ),
        fires
    );
    // Only one of the two words before the cue survives: applied.
    assert_eq!(
        j(
            "buy fresh apples scratch that buy pears",
            "Buy fresh pears."
        ),
        ok
    );
    // Multiset: one of two copies of a word is gone, so something was cancelled.
    assert_eq!(
        j(
            "email the design team scratch that email the sales team",
            "Email the design. Email the sales team."
        ),
        ok
    );
}
