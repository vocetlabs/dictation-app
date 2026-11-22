//! EVAL1: each dictation's raw transcript and final text, for the bench's
//! eval builds only. The shell sets a [`DraftLog`] only when it is built with
//! its `eval-capture` feature, which is off by default and never passed for a
//! release; every other build leaves [`Extras::drafts`] empty, so nothing is
//! recorded. What is recorded is handed to the shell's writer as one JSON line
//! and never logged.
//!
//! [`Extras::drafts`]: crate::pipeline::Extras::drafts

use std::fmt::Write as _;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use dictation_ports::CleanupOutcome;

/// Hands each dictation's drafts, as one JSON line, to a writer.
#[derive(Clone)]
pub struct DraftLog {
    write: Arc<dyn Fn(&str) + Send + Sync>,
}

impl DraftLog {
    /// Calls `write` with one JSON line (no newline) per transcribed
    /// dictation.
    pub fn new(write: impl Fn(&str) + Send + Sync + 'static) -> Self {
        Self {
            write: Arc::new(write),
        }
    }

    /// Records one dictation: what speech-to-text returned, the text handed
    /// on for the paste, and what the cleanup pass did (`None` when none ran).
    pub fn record(&self, raw: &str, final_text: &str, cleanup: Option<CleanupOutcome>) {
        (self.write)(&line(now_ms(), raw, final_text, cleanup));
    }
}

impl std::fmt::Debug for DraftLog {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DraftLog")
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

/// `{"finished_at_ms":…,"raw":…,"final":…,"cleanup":…}`.
fn line(
    finished_at_ms: u64,
    raw: &str,
    final_text: &str,
    cleanup: Option<CleanupOutcome>,
) -> String {
    let mut out = format!("{{\"finished_at_ms\":{finished_at_ms},\"raw\":");
    push_json_string(&mut out, raw);
    out.push_str(",\"final\":");
    push_json_string(&mut out, final_text);
    out.push_str(",\"cleanup\":");
    match cleanup {
        Some(outcome) => push_json_string(&mut out, outcome.name()),
        None => out.push_str("null"),
    }
    out.push('}');
    out
}

/// `text` as a JSON string (RFC 8259): quotes, backslashes and control
/// characters escaped, everything else as is.
fn push_json_string(out: &mut String, text: &str) {
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if u32::from(c) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", u32::from(c));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, reason = "tests")]

    use std::sync::Mutex;

    use super::*;

    #[test]
    fn a_line_holds_both_texts_and_the_outcome() {
        let got = line(7, "um, hi", "Hi.", Some(CleanupOutcome::Applied));
        assert_eq!(
            got,
            r#"{"finished_at_ms":7,"raw":"um, hi","final":"Hi.","cleanup":"applied"}"#
        );
        let none = line(7, "hi", "hi", None);
        assert!(none.ends_with(r#""cleanup":null}"#), "{none}");
    }

    #[test]
    fn text_is_escaped_as_json() {
        let text = "say \"hi\"\\ back\nnow\t\r\u{1}é 😀";
        let got = line(1, text, "", Some(CleanupOutcome::FallbackTimeout));
        let parsed: serde_json::Value = serde_json::from_str(&got).unwrap();
        assert_eq!(parsed["raw"], text);
        assert_eq!(parsed["final"], "");
        assert_eq!(parsed["cleanup"], "fallback_timeout");
        assert!(!got.contains('\n'), "one line");
    }

    #[test]
    fn record_hands_one_line_to_the_writer() {
        let lines = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&lines);
        let log = DraftLog::new(move |l| sink.lock().unwrap().push(l.to_owned()));
        log.record("a", "b", Some(CleanupOutcome::FallbackGuard));
        let lines = lines.lock().unwrap();
        assert_eq!(lines.len(), 1);
        let parsed: serde_json::Value = serde_json::from_str(&lines[0]).unwrap();
        assert_eq!(parsed["raw"], "a");
        assert_eq!(parsed["final"], "b");
        assert_eq!(parsed["cleanup"], "fallback_guard");
        assert!(parsed["finished_at_ms"].as_u64().unwrap() > 0);
        assert_eq!(format!("{log:?}"), "DraftLog", "never the text");
    }
}
