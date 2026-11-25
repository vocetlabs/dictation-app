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
