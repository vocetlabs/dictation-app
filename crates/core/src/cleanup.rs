//! The cleanup pass after transcription (Q2): the system prompt, the user
//! message that wraps the transcript, and the guard that decides whether a
//! model's reply may replace the transcript.
//!
//! Pure. The request is made by `dictation-transcribe`, the deadline and the
//! fallback live in `dictation-pipeline`: whatever goes wrong (a timeout, an
//! error, a reply the guard rejects), the raw transcript is pasted.
//!
//! The guard is ported from the experimental branch `exp/groq-cleanup`
//! (draft PR #324, `crates/transcribe/src/groq_cleanup.rs`): a reply is
//! pasted only if it says something, is not an echo of the prompt, is not
//! much longer than the transcript, and keeps every number, email/URL/file
//! name and capitalised name of the transcript, unless the transcript
//! corrects it right after ("20 copies, make that 30"; CLN1). It also refuses a reply
//! that removed a cancel cue ("scratch that") but kept what it cancelled. The echo check takes its
//! idea from Blurt (MIT, credited in `NOTICE`).
//!
//! The prompt is v7 (CLN1; v4 came from the offline cleanup eval, PR #327),
//! kept byte for byte in
//! `crates/core/prompts/cleanup.txt`, which the eval harness reads too. Its
//! first version derives from Blurt's Smart cleanup instruction (MIT).

use std::time::Duration;

/// The prompt file exactly as the eval keeps it (with its final newline).
pub const PROMPT_FILE: &str = include_str!("../prompts/cleanup.txt");

/// A short name for the prompt, for logs.
pub const PROMPT_NAME: &str = "v7";

/// Opens the transcript in the user message.
pub const OPEN_TAG: &str = "<transcript>";

/// Closes the transcript in the user message.
pub const CLOSE_TAG: &str = "</transcript>";

/// How long a cleanup, cloud or on-device, may take, from the transcript to
/// the reply, before the raw transcript is pasted and the request cancelled.
/// One deadline for both (LAT4, owner decision 2026-11-22). Cloud (LAT2): an
/// offline replay of 151 saved drafts pinned to Together scored ZER 86.1 with
/// no deadline against 83.4 at 1.5 s, and its replies had p50 0.66 s, p90
/// 1.35 s, max 2.66 s; live p95 was 1.33 s. On-device: Gemma 4 E2B on an M4
/// Pro (LCL1, 151 drafts) took at most 2.80 s. Slower Macs paste raw text a
/// little more often (#374). The helper request has no whole-request timeout
/// of its own; this is the generation deadline (the shared HTTP client keeps
/// its 10 s connect timeout).
pub const TIMEOUT: Duration = Duration::from_millis(3_000);

/// A reply longer than this many times the transcript (plus
/// [`LENGTH_SLACK`] characters) is not a cleanup.
const LENGTH_RATIO: f64 = 1.25;

/// Characters a reply may add beyond [`LENGTH_RATIO`] (punctuation added
/// to a short transcript).
const LENGTH_SLACK: usize = 20;

/// A prompt sentence shorter than this, normalised, is something a person
/// says and is not held against a reply.
const SENTENCE_FLOOR: usize = 12;

/// How far after a number or name a correction cue may sit for the guard to
/// let the reply drop it (CLN1).
const CUE_WINDOW: usize = 30;

/// Words that mark a spoken self-correction, lowercase.
const CORRECTION_CUES: [&str; 9] = [
    "sorry",
    "wait",
    "no",
    "actually",
    "make that",
    "i mean",
    "rather",
    "scratch that",
    "correction",
];

/// Cues that cancel a whole clause, lowercase.
const CANCEL_CUES: [&str; 8] = [
    "scratch that",
    "never mind",
    "nevermind",
    "forget that",
    "forget it",
    "ignore that",
    "cancel that",
    "delete that",
];

/// The cue words a reply may drop when it removes a cancel cue.
const CANCEL_WORDS: [&str; 8] = [
    "scratch",
    "never",
    "mind",
    "nevermind",
    "forget",
    "ignore",
    "cancel",
    "delete",
];

/// Words that lead into a cancel cue: skipped before it, free to drop.
const CANCEL_LEAD: [&str; 8] = [
    "actually", "wait", "sorry", "no", "oh", "ok", "okay", "well",
];

/// Words with no content, ignored by the cancel check.
const CANCEL_STOP: [&str; 44] = [
    "a", "an", "the", "um", "uh", "erm", "er", "ah", "hmm", "mm", "so", "like", "you", "know", "i",
    "me", "my", "we", "our", "us", "is", "are", "was", "were", "be", "to", "of", "in", "on", "at",
    "for", "and", "or", "but", "it", "that", "this", "can", "could", "would", "will", "just",
    "kind", "sort",
];

/// Number words, each at the index of its digit.
const NUMBER_WORDS: [&str; 13] = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve",
];

/// The system prompt: [`PROMPT_FILE`] trimmed, as the eval sent it.
#[must_use]
pub fn prompt() -> &'static str {
    PROMPT_FILE.trim()
}

/// The user message for `transcript`: the transcript between the tags.
#[must_use]
pub fn user_message(transcript: &str) -> String {
    format!("{OPEN_TAG}\n{transcript}\n{CLOSE_TAG}")
}

/// A reply's text without the transcript tags, if the model repeated them.
#[must_use]
pub fn strip_tags(content: &str) -> &str {
    let mut text = content.trim();
    text = text.strip_prefix(OPEN_TAG).unwrap_or(text).trim_start();
    text.strip_suffix(CLOSE_TAG).unwrap_or(text).trim_end()
}

/// What the guard made of a reply.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Judgement {
    /// The reply passed every check: paste it.
    Accepted,
    /// The reply had no words.
    Empty,
    /// The reply was (part of) the prompt.
    Echo,
    /// The reply was much longer than the transcript.
    TooLong,
    /// A number of the transcript is missing from the reply.
    DroppedNumber,
    /// An email, URL or file name of the transcript is missing.
    DroppedLink,
    /// A capitalised name of the transcript is missing.
    DroppedName,
    /// A cancel cue is gone but the words it cancelled are all still there.
    UnresolvedCancel,
}

impl Judgement {
    /// A short name for logs.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Accepted => "accepted",
            Self::Empty => "empty",
            Self::Echo => "echo",
            Self::TooLong => "too_long",
            Self::DroppedNumber => "dropped_number",
            Self::DroppedLink => "dropped_link",
            Self::DroppedName => "dropped_name",
            Self::UnresolvedCancel => "unresolved_cancel",
        }
    }
}

/// Whether `reply` may replace `raw`: [`Judgement::Accepted`] if so, else
/// the first check it fails. `prompt` is the system prompt the reply must
/// not echo.
#[must_use]
pub fn judge(raw: &str, reply: &str, prompt: &str) -> Judgement {
    if normalized(reply).is_empty() {
        return Judgement::Empty;
    }
    if is_echo(reply, prompt) {
        return Judgement::Echo;
    }
    let (raw_len, reply_len) = (raw.chars().count(), reply.chars().count());
    #[allow(
        clippy::cast_precision_loss,
        reason = "lengths of dictated text are far below 2^52"
    )]
    if reply_len as f64 > raw_len as f64 * LENGTH_RATIO + LENGTH_SLACK as f64 {
        return Judgement::TooLong;
    }
    let kept = numbers(reply);
    if numbers(raw)
        .iter()
        .any(|n| !kept.contains(n) && !corrected(raw, n))
    {
        return Judgement::DroppedNumber;
    }
    let lower = reply.to_lowercase();
    if links(raw).iter().any(|link| !lower.contains(link.as_str())) {
        return Judgement::DroppedLink;
    }
    let words = word_parts(reply);
    if names(raw).iter().any(|name| {
        word_parts(name).iter().any(|part| !words.contains(part)) && !corrected(raw, name)
    }) {
        return Judgement::DroppedName;
    }
    if unresolved_cancel(raw, reply) {
        return Judgement::UnresolvedCancel;
    }
    Judgement::Accepted
}

/// Whether the reply removed a cancel cue ("scratch that") without applying
/// it: the two content words before the cue are still there, and nothing but
/// cue words and [`CANCEL_LEAD`] words is gone from the transcript. A cue the
/// reply keeps verbatim doesn't count. Ported from `eval/guard.py`.
fn unresolved_cancel(raw: &str, reply: &str) -> bool {
    let raw = raw.to_lowercase();
    let reply_lower = reply.to_lowercase();
    let kept = content_words(reply);
    let reply_has_cue = !cancel_cues(&reply_lower).is_empty();
    cancel_cues(&raw).into_iter().any(|(at, cue)| {
        if reply_has_cue && reply_lower.contains(cue) {
            return false;
        }
        let mut before = content_words(&raw[..at]);
        before.retain(|w| !CANCEL_LEAD.contains(&w.as_str()));
        let last_two = &before[before.len().saturating_sub(2)..];
        if last_two.is_empty() || !last_two.iter().all(|w| kept.contains(w)) {
            return false;
        }
        let mut left = kept.clone();
        content_words(&raw).iter().all(|word| {
            if let Some(i) = left.iter().position(|w| w == word) {
                left.swap_remove(i);
                return true;
            }
            CANCEL_WORDS.contains(&word.as_str()) || CANCEL_LEAD.contains(&word.as_str())
        })
    })
}

/// Where each whole-word cancel cue starts in `text` (already lowercased).
fn cancel_cues(text: &str) -> Vec<(usize, &'static str)> {
    let word = |c: char| c.is_alphanumeric() || c == '_';
    text.char_indices()
        .filter(|&(at, _)| !text[..at].chars().next_back().is_some_and(word))
        .filter_map(|(at, _)| {
            CANCEL_CUES
                .iter()
                .find(|cue| {
                    text[at..]
                        .strip_prefix(**cue)
                        .is_some_and(|rest| !rest.chars().next().is_some_and(word))
                })
                .map(|&cue| (at, cue))
        })
        .collect()
}

/// The lowercased words of `text` (ASCII letters, digits, apostrophes) that
/// carry content: without [`CANCEL_STOP`], number words up to twelve as
/// digits.
fn content_words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .replace('\u{2019}', "'")
        .split(|c: char| !(c.is_ascii_lowercase() || c.is_ascii_digit() || c == '\''))
        .filter(|w| !w.is_empty() && !CANCEL_STOP.contains(w))
        .map(|w| {
            NUMBER_WORDS
                .iter()
                .position(|n| *n == w)
                .map_or_else(|| w.to_owned(), |digit| digit.to_string())
        })
        .collect()
}

/// Whether every occurrence of `value` (a number or a name) in `raw` is
/// followed within [`CUE_WINDOW`] characters by a correction cue
/// ("9, sorry, 10", "Sunday? No, wait, Saturday"): dropping it from the
/// reply is then resolving a self-correction, not losing content. Whole
/// numbers and words only (`"2"` is not in `"2.5"` or `"12"`), an ordinal
/// suffix (`23rd`) belongs to the number, and a thousands comma may sit
/// between digits (`1,200` for `1200`). Ported from `eval/guard.py`.
fn corrected(raw: &str, value: &str) -> bool {
    let raw: Vec<char> = raw.chars().collect();
    let value: Vec<char> = value.chars().collect();
    let is_number = value.first().is_some_and(char::is_ascii_digit);
    let word = |c: char| c.is_alphanumeric() || c == '_';
    let mut spots = Vec::new();
    let mut start = 0;
    while start < raw.len() {
        let before_ok = start == 0 || {
            let b = raw[start - 1];
            !word(b) && b != '.' && b != ','
        };
        match before_ok
            .then(|| match_value(&raw, start, &value, is_number))
            .flatten()
        {
            Some(end) => {
                // Optional ordinal suffix, then the whole-word lookahead.
                let with_suffix = [['s', 't'], ['t', 'h'], ['n', 'd'], ['r', 'd']]
                    .iter()
                    .any(|suffix| raw.get(end..end + 2) == Some(suffix.as_slice()))
                    .then_some(end + 2);
                let ends_value = |at: usize| {
                    let next = raw.get(at).copied();
                    let after = raw.get(at + 1).copied();
                    let number_continues = matches!(next, Some('.' | ',' | ':'))
                        && after.is_some_and(|c| c.is_ascii_digit());
                    !(next.is_some_and(word) || number_continues)
                };
                let end = with_suffix
                    .filter(|&e| ends_value(e))
                    .or_else(|| ends_value(end).then_some(end));
                match end {
                    Some(e) => {
                        spots.push(e);
                        start = e.max(start + 1);
                    }
                    None => start += 1,
                }
            }
            None => start += 1,
        }
    }
    !spots.is_empty()
        && spots.iter().all(|&end| {
            let window: String = raw[end..].iter().take(CUE_WINDOW).collect();
            has_cue(&window)
        })
}

/// The end of `value` matched at `raw[start..]`, if it does. A number may
/// have a comma between any two of its characters.
fn match_value(raw: &[char], start: usize, value: &[char], is_number: bool) -> Option<usize> {
    let mut at = start;
    for (i, &c) in value.iter().enumerate() {
        if i > 0 && is_number && raw.get(at) == Some(&',') {
            at += 1;
        }
        if raw.get(at) != Some(&c) {
            return None;
        }
        at += 1;
    }
    Some(at)
}

/// Whether `window` holds a correction cue as whole words, any case.
fn has_cue(window: &str) -> bool {
    let chars: Vec<char> = window.chars().flat_map(char::to_lowercase).collect();
    let word = |c: char| c.is_alphanumeric() || c == '_';
    (0..chars.len()).any(|i| {
        (i == 0 || !word(chars[i - 1]))
            && CORRECTION_CUES.iter().any(|cue| {
                let n = cue.chars().count();
                chars
                    .get(i..i + n)
                    .is_some_and(|w| w.iter().copied().eq(cue.chars()))
                    && !chars.get(i + n).copied().is_some_and(word)
            })
    })
}

/// Whether `reply` is a run of `prompt`: the whole of the reply is inside
/// the prompt, or one of the prompt's longer sentences is inside the reply.
#[must_use]
pub fn is_echo(reply: &str, prompt: &str) -> bool {
    let reply = format!(" {} ", normalized(reply));
    if format!(" {} ", normalized(prompt)).contains(&reply) {
        return true;
    }
    prompt
        .split(['.', '\n', ':', ';'])
        .map(normalized)
        .filter(|sentence| sentence.chars().count() >= SENTENCE_FLOOR)
        .any(|sentence| reply.contains(&format!(" {sentence} ")))
}

/// Lowercased letters and digits, single-spaced.
fn normalized(text: &str) -> String {
    let mut out = String::new();
    let mut gap = false;
    for c in text.chars().flat_map(char::to_lowercase) {
        if c.is_alphanumeric() {
            if gap && !out.is_empty() {
                out.push(' ');
            }
            gap = false;
            out.push(c);
        } else {
            gap = true;
        }
    }
    out
}

/// The numbers in `text`: runs of digits, with a `.`, `,` or `:` between
/// two digits kept inside one number and thousands commas removed
/// (`"$1,750.50"` is `1750.50`).
fn numbers(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut found = Vec::new();
    let mut current = String::new();
    for (i, &c) in chars.iter().enumerate() {
        let joins = matches!(c, '.' | ',' | ':')
            && !current.is_empty()
            && chars.get(i + 1).is_some_and(char::is_ascii_digit);
        if c.is_ascii_digit() {
            current.push(c);
        } else if joins {
            if c != ',' {
                current.push(c);
            }
        } else if !current.is_empty() {
            found.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        found.push(current);
    }
    found
}

/// Emails, URLs and dotted names (`northwind.io`, `billing.ts`) in `text`,
/// lowercased and without surrounding punctuation.
fn links(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(|token| {
            token
                .trim_matches(|c: char| !c.is_alphanumeric() && c != '/')
                .trim_end_matches('/')
                .to_lowercase()
        })
        .filter(|token| is_link(token))
        .collect()
}

fn is_link(token: &str) -> bool {
    if token.contains("://") {
        return true;
    }
    if let Some((user, host)) = token.split_once('@') {
        return !user.is_empty() && host.contains('.');
    }
    let host = token.split('/').next().unwrap_or_default();
    let labels: Vec<&str> = host.split('.').collect();
    labels.len() >= 2
        && labels.iter().all(|label| {
            !label.is_empty() && label.chars().all(|c| c.is_alphanumeric() || c == '-')
        })
        && labels
            .last()
            .is_some_and(|tld| tld.chars().count() >= 2 && tld.chars().all(char::is_alphabetic))
}

/// Capitalised words that don't start a sentence (`"Priya"` in "ask
/// Priya", not `"Okay"` in "Okay, so"), without surrounding punctuation.
/// "I" and its contractions don't count.
fn names(text: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut sentence_start = true;
    for token in text.split_whitespace() {
        let word = token.trim_matches(|c: char| !c.is_alphanumeric());
        let capitalised = word.chars().next().is_some_and(char::is_uppercase);
        let pronoun = word == "I" || word.starts_with("I'") || word.starts_with("I\u{2019}");
        if capitalised && !sentence_start && !pronoun {
            found.push(word.to_owned());
        }
        sentence_start = token.ends_with(['.', '!', '?', ':', '\n']) || word.is_empty();
    }
    found
}

/// The lowercased runs of letters and digits in `text`.
fn word_parts(text: &str) -> Vec<String> {
    normalized(text)
        .split(' ')
        .filter(|w| !w.is_empty())
        .map(str::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p() -> &'static str {
        prompt()
    }

    /// SHA-256 of `~/vocet-screens/u9/cln1-prompt-v7.txt` (the CLN1 input).
    const V7_SHA256: &str = "b4172ea66605dcb1bb619b88a67055f7f26e94c504d042f88174835a75bd5314";

    fn sha256_hex(data: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        use std::fmt::Write as _;
        Sha256::digest(data)
            .iter()
            .fold(String::new(), |mut hex, b| {
                let _ = write!(hex, "{b:02x}");
                hex
            })
    }

    #[test]
    fn criterion_1_the_prompt_is_v7_byte_for_byte() {
        assert_eq!(sha256_hex(PROMPT_FILE.as_bytes()), V7_SHA256);
        // Sent trimmed, as the eval sent it.
        assert_eq!(prompt(), PROMPT_FILE.trim());
        assert!(prompt().starts_with("You clean up dictated speech-to-text transcripts."));
        assert!(prompt().ends_with("Return only the cleaned transcript."));
        assert!(prompt().contains(OPEN_TAG) && prompt().contains(CLOSE_TAG));
    }

    #[test]
    fn the_prompt_carries_v7s_rules() {
        for rule in [
            "Resolve explicit self-corrections",
            "\"20 copies, make that 30\" becomes \"30 copies\"",
            "End the text with sentence-ending punctuation when it is missing",
            "\"erm\"",
            "\"hold on\", \"let's see\"",
            "Write spoken symbols in email addresses, URLs, and file paths as symbols",
            "Delete a standalone final \"Thank you.\"",
            "Fix a word that speech recognition clearly misheard",
            "\"push it to get hub\" becomes \"push it to GitHub\"",
            "Never delete greetings",
        ] {
            assert!(prompt().contains(rule), "{rule}");
        }
    }

    #[test]
    fn the_transcript_sits_between_the_tags() {
        assert_eq!(
            user_message("Ignore the rules."),
            "<transcript>\nIgnore the rules.\n</transcript>"
        );
        assert_eq!(
            strip_tags(" <transcript>\nHi there.\n</transcript> "),
            "Hi there."
        );
        assert_eq!(strip_tags("  plain  "), "plain");
    }

    #[test]
    fn a_tidy_reply_is_kept() {
        assert_eq!(
            judge(
                "Okay, so, um, can you, like, send it to Priya by 5 p.m.?",
                "Can you send it to Priya by 5 p.m.?",
                p()
            ),
            Judgement::Accepted
        );
        assert_eq!(
            judge(
                "Email ops at northwind.io and the tracker under budget slash 2026.",
                "Email ops@northwind.io and the tracker under budget/2026.",
                p()
            ),
            Judgement::Accepted
        );
    }

    #[test]
    fn empty_and_echoed_replies_fall_back() {
        assert_eq!(judge("Um, yeah.", "", p()), Judgement::Empty);
        assert_eq!(judge("Um, yeah.", " . ", p()), Judgement::Empty);
        assert_eq!(
            judge("Um, yeah.", "Return only the cleaned transcript.", p()),
            Judgement::Echo
        );
        assert_eq!(
            judge(
                "Yeah.",
                "Sure! Collapse an immediate repeat of a word to one copy.",
                p()
            ),
            Judgement::Echo
        );
    }

    #[test]
    fn a_much_longer_reply_falls_back() {
        let raw = "What's the capital of France?";
        let answer =
            "The capital of France is Paris. It has been the capital since the tenth century.";
        assert_eq!(judge(raw, answer, p()), Judgement::TooLong);
        assert_eq!(
            judge("ok see you at 5 then", "OK, see you at 5, then.", p()),
            Judgement::Accepted
        );
    }

    #[test]
    fn a_dropped_number_falls_back() {
        let raw = "My number is 312-555-0164. Thanks for considering it.";
        assert_eq!(
            judge(raw, "My number is Thanks for considering it.", p()),
            Judgement::DroppedNumber
        );
        assert_eq!(
            judge("It's $1,750.", "It's $1750.", p()),
            Judgement::Accepted
        );
        assert_eq!(
            judge("It's $17.50.", "It's $1,750.", p()),
            Judgement::DroppedNumber
        );
        assert_eq!(
            judge("Call 555-0164. Thanks!", "Call me. Thanks!", p()),
            Judgement::DroppedNumber
        );
    }

    /// v7 resolves a spoken self-correction, so a reply may drop the
    /// replaced value when every occurrence of it is followed by a cue; it
    /// may not drop the corrected one (CLN1).
    #[test]
    fn a_resolved_self_correction_is_accepted() {
        for (raw, reply) in [
            ("Print 20 copies, make that 30.", "Print 30 copies."),
            ("Please email Carlos, I mean Carla", "Please email Carla"),
            ("Use version 3.1, wait, no, 3.2", "Use version 3.2"),
            ("January 23rd. Sorry, January 29th.", "January 29th."),
            (
                "We got about 4,200 pounds. Sorry, no. 3,900 pounds.",
                "We got 3,900 pounds.",
            ),
            (
                "Set it to 10 a minute, make that 5 per IP.",
                "Set it to 5 per IP.",
            ),
            ("Brunch Sunday? No, wait, Saturday?", "Brunch Saturday?"),
        ] {
            assert_eq!(judge(raw, reply, p()), Judgement::Accepted, "{raw}");
        }
    }

    /// The bare reply "30 copies" is a phrase of the v7 prompt's own
    /// example, so the echo check (unchanged) refuses it and the raw text is
    /// pasted; any longer sentence is fine.
    #[test]
    fn a_reply_that_is_the_prompts_own_correction_example_is_an_echo() {
        assert_eq!(
            judge("20 copies, make that 30", "30 copies", p()),
            Judgement::Echo
        );
    }

    #[test]
    fn dropping_the_corrected_value_or_one_with_no_cue_still_falls_back() {
        for (raw, reply) in [
            // The corrected value itself.
            ("January 23rd. Sorry, January 29th.", "January 23rd."),
            (
                "It started in build 4.2, wait, no, 4.3.",
                "It started in build 4.2.",
            ),
            // No cue after the number.
            ("Call 555-0164. Thanks!", "Call me. Thanks!"),
            ("Pay 40 now.", "Pay now."),
            // Cue too far away (more than 30 characters).
            (
                "Order 20 copies for the whole office this week, I mean it.",
                "Order copies for the whole office this week, I mean it.",
            ),
            // Not a whole word: "no" inside "november", "2" inside "2.5".
            ("Send 2 by november", "Send by november"),
            // "Wait" is part of a longer word.
            ("Pay 8 waiting fees", "Pay waiting fees"),
        ] {
            assert_eq!(judge(raw, reply, p()), Judgement::DroppedNumber, "{raw}");
        }
        // Once corrected, once not: the uncorrected occurrence keeps the rule.
        assert_eq!(
            judge(
                "Meet at 5, sorry, 6. The doors open at 5 sharp.",
                "Meet at 6. The doors open sharp.",
                p()
            ),
            Judgement::DroppedNumber
        );
        // A name with no cue after it.
        assert_eq!(
            judge("Email Carlos today", "Email today", p()),
            Judgement::DroppedName
        );
    }

    #[test]
    fn a_dropped_link_is_refused_even_with_a_cue() {
        for (raw, reply) in [
            (
                "Write to d.ramirez@acme.com, sorry, to ops@acme.com",
                "Write to ops@acme.com",
            ),
            ("See https://x.dev/a, I mean it", "See it, I mean it"),
            ("Open billing.ts, no, wait, main.rs", "Open main.rs"),
        ] {
            assert_eq!(judge(raw, reply, p()), Judgement::DroppedLink, "{raw}");
        }
    }

    #[test]
    fn corrected_reads_the_cue_window_and_whole_words() {
        assert!(corrected("at 9, sorry, 10", "9"));
        assert!(corrected("at 1,200, sorry, 900", "1200"));
        assert!(corrected("the 1st, sorry, the 2nd", "1"));
        assert!(!corrected("at 2.5, sorry, 3", "2"));
        assert!(!corrected("at 12, sorry, 13", "2"));
        assert!(!corrected("at 9", "9"));
        assert!(!corrected("nothing here", "9"));
        assert!(corrected("Ask Carlos, ACTUALLY Carla", "Carlos"));
        assert!(!corrected("Ask Carlos, actuallyish Carla", "Carlos"));
    }

    /// The cue went but the cancelled words stayed: paste the raw text
    /// (CLN1 criterion 2b).
    #[test]
    fn a_cancel_cue_removed_without_cancelling_falls_back() {
        let raw = "the meeting is on monday. the call is at eleven am. \
                   scratch that the meeting is on thursday.";
        for reply in [
            "The meeting is on Monday. The call is at eleven am. The meeting is on Thursday.",
            "The meeting is on Monday. The call is at 11 am. The meeting is on Thursday.",
        ] {
            assert_eq!(
                judge(raw, reply, p()),
                Judgement::UnresolvedCancel,
                "{reply}"
            );
        }
        // Every cue, any case, with lead words and cue words free to drop.
        for cue in CANCEL_CUES {
            let capital = cue[..1].to_uppercase() + &cue[1..];
            let raw = format!("book the blue room, oh wait. {capital} book the red one");
            assert_eq!(
                judge(&raw, "Book the blue room. Book the red one.", p()),
                Judgement::UnresolvedCancel,
                "{cue}"
            );
        }
    }

    #[test]
    fn an_applied_cancellation_is_accepted() {
        for (raw, reply) in [
            (
                "send it to the data team never mind to the design team",
                "Send it to the design team.",
            ),
            (
                "delete the old files. actually, never mind, keep them",
                "Keep the old files.",
            ),
            (
                "order the green chairs for the lobby, they look good with the carpet and \
                 the new lamps, and then book the movers for friday, scratch that order the \
                 grey chairs",
                "Order the grey chairs.",
            ),
        ] {
            assert_eq!(judge(raw, reply, p()), Judgement::Accepted, "{raw}");
        }
    }

    #[test]
    fn the_cancel_check_needs_a_removed_whole_cue() {
        for (raw, reply) in [
            // Kept verbatim.
            (
                "book the blue room scratch that book the red one",
                "Book the blue room, scratch that, book the red one.",
            ),
            // No cue.
            (
                "book the blue room and then the red one",
                "Book the blue room and then the red one.",
            ),
            // Not whole words.
            (
                "the blue room has a scratch thatch roof",
                "The blue room has a scratch thatch roof.",
            ),
            // Nothing before the cue.
            ("never mind the weather today", "Mind the weather today."),
        ] {
            assert_eq!(judge(raw, reply, p()), Judgement::Accepted, "{raw}");
        }
        assert_eq!(
            content_words("It\u{2019}s Twelve o'clock, so GO"),
            ["it's", "12", "o'clock", "go"]
        );
    }

    #[test]
    fn a_dropped_link_falls_back() {
        assert_eq!(
            judge(
                "Register at summit.northwind.io slash register.",
                "Register at the summit page.",
                p()
            ),
            Judgement::DroppedLink
        );
        assert_eq!(
            judge(
                "Write to d.ramirez@acme.com today.",
                "Write to them today.",
                p()
            ),
            Judgement::DroppedLink
        );
        assert_eq!(
            judge("See https://x.dev/a for it.", "See it.", p()),
            Judgement::DroppedLink
        );
        assert_eq!(
            judge("At 5 p.m. e.g. now.", "At 5 p.m. now.", p()),
            Judgement::Accepted
        );
    }

    #[test]
    fn a_dropped_name_falls_back() {
        assert_eq!(
            judge(
                "So I talked to Tomas Herrera about it.",
                "I talked to him about it.",
                p()
            ),
            Judgement::DroppedName
        );
        assert_eq!(
            judge(
                "Okay. So I think, um, it works. Like, really.",
                "I think it works. Really.",
                p()
            ),
            Judgement::Accepted
        );
    }

    /// Replies that follow the prompt's rules are accepted by the guard.
    #[test]
    fn replies_that_follow_the_prompts_rules_are_accepted() {
        let cases = [
            // Self-corrections stay as spoken: both values kept.
            (
                "Let's meet on Monday, sorry, Tuesday at 3.",
                "Let's meet on Monday, sorry, Tuesday at 3.",
            ),
            (
                "Print 20 copies, make that 30.",
                "Print 20 copies, make that 30.",
            ),
            // Spoken symbols inside an address become symbols.
            (
                "Mail sam at example dot com about it.",
                "Mail sam@example.com about it.",
            ),
            (
                "The guide is at docs.example.org slash setup.",
                "The guide is at docs.example.org/setup.",
            ),
            // A phantom final "Thank you." on a note to an assistant goes.
            (
                "Add milk to the shopping list. Thank you.",
                "Add milk to the shopping list.",
            ),
            // Misheard technical words fixed; code names written as code.
            (
                "Um, commit and push it to get hub tonight.",
                "Commit and push it to GitHub tonight.",
            ),
            (
                "Load the jason file from disk.",
                "Load the JSON file from disk.",
            ),
            (
                "Rename the get user name function.",
                "Rename the getUserName function.",
            ),
            // False starts: only the completed restart is kept.
            (
                "Can you? Can you review the draft?",
                "Can you review the draft?",
            ),
            // Openers go; greetings stay.
            (
                "Hey Marcus, so, um, the deploy is done.",
                "Hey Marcus, the deploy is done.",
            ),
        ];
        for (raw, reply) in cases {
            assert_eq!(judge(raw, reply, p()), Judgement::Accepted, "{raw}");
        }
    }

    /// The guard still refuses replies that lose content, even when the
    /// rule behind them is a good one (eval: `billing.tease` → `billing.ts`
    /// is refused, by design, until the guard learns close spellings).
    #[test]
    fn replies_that_lose_content_are_refused() {
        assert_eq!(
            judge(
                "Open billing.tease and fix it.",
                "Open billing.ts and fix it.",
                p()
            ),
            Judgement::DroppedLink
        );
        // Answering the transcript instead of cleaning it.
        assert_eq!(
            judge(
                "What time is it in Tokyo?",
                "It is 3 in the afternoon in Tokyo right now, Japan Standard Time.",
                p()
            ),
            Judgement::TooLong
        );
        // Dropping a value of a kept self-correction's other side.
        assert_eq!(
            judge(
                "Set the limit to 3.1, wait, no, 3.2.",
                "Set the limit to 3.1.",
                p()
            ),
            Judgement::DroppedNumber
        );
    }

    /// A reply that is wholly one of the prompt's own examples reads as an echo of
    /// the prompt, as on the eval branch: the raw text is pasted, which
    /// loses only the cleanup of that one phrase.
    #[test]
    fn a_reply_that_is_one_of_the_prompts_examples_is_an_echo() {
        assert_eq!(
            judge("Push it to get hub.", "Push it to GitHub.", p()),
            Judgement::Echo
        );
    }

    #[test]
    fn the_extractors_find_what_they_should() {
        assert_eq!(
            numbers("v2.4 on 4:30, $1,750 and 3."),
            ["2.4", "4:30", "1750", "3"]
        );
        assert_eq!(
            links("Mail Ops@Northwind.io, see fieldbook.app/new. Also billing.ts!"),
            ["ops@northwind.io", "fieldbook.app/new", "billing.ts"]
        );
        assert_eq!(
            names("Hi Marcus, I'm with Priya. Okay ask Owen Park's team"),
            ["Marcus", "Priya", "Owen", "Park's"]
        );
    }

    #[test]
    fn judgements_have_names_and_the_timeout_is_three_seconds() {
        assert_eq!(Judgement::DroppedNumber.name(), "dropped_number");
        assert_eq!(Judgement::Accepted.name(), "accepted");
        assert_eq!(Judgement::UnresolvedCancel.name(), "unresolved_cancel");
        assert_eq!(TIMEOUT, Duration::from_millis(3_000));
        assert_eq!(PROMPT_NAME, "v7");
    }
}
