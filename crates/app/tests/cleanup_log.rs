//! QT1 item 5: one info line per cleaned dictation with the outcome and the
//! duration, and never the text. Its own test binary: it is the only test in
//! the process, so tracing's callsite cache and the subscriber are its own
//! (plain `cargo test` runs the other cleanup tests in another binary).

#![allow(clippy::unwrap_used, reason = "test helpers fail the test on purpose")]

mod common;

use std::sync::{Arc, Mutex};

use common::{CLEANED, Harness, Script, WAIT};
use dictation_ports::CleanupError;

#[derive(Clone, Default)]
struct Logged(Arc<Mutex<Vec<u8>>>);

impl std::io::Write for Logged {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0.lock().unwrap().extend_from_slice(buf);
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for Logged {
    type Writer = Self;
    fn make_writer(&'a self) -> Self::Writer {
        self.clone()
    }
}

/// QT1 item 5: one info line per cleaned dictation with the outcome and
/// the duration, and never the text.
#[tokio::test]
async fn qt1_each_cleanup_logs_one_info_line_with_the_outcome_and_no_text() {
    let logged = Logged::default();
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_ansi(false)
        .with_writer(logged.clone())
        .finish();
    let _guard = tracing::subscriber::set_default(subscriber);
    let mut harness = Harness::start(
        WAIT,
        vec![
            Script::Reply(CLEANED),
            Script::Reply("Send the report to her."),
            Script::Fail(CleanupError::Network),
            Script::Fail(CleanupError::Timeout),
        ],
    );
    for _ in 0..4 {
        harness.dictate().await;
    }
    harness.finish().await;
    let log = String::from_utf8(logged.0.lock().unwrap().clone()).unwrap();
    let lines: Vec<&str> = log.lines().filter(|l| l.contains("cleanup")).collect();
    for (line, outcome) in lines.iter().zip([
        "applied",
        "fallback_guard",
        "fallback_error",
        "fallback_timeout",
    ]) {
        assert!(
            line.contains(&format!("outcome=\"{outcome}\""))
                || line.contains(&format!("outcome={outcome}")),
            "{line}"
        );
        assert!(line.contains("duration_ms="), "{line}");
    }
    assert_eq!(lines.len(), 4, "{log}");
    assert!(!log.contains("Priya") && !log.contains("report"), "{log}");
}

/// LAT1: the line carries the host's name when the reply names one, and no
/// `provider` field when it doesn't. The key going down warms the connection.
#[tokio::test]
async fn lat1_the_cleanup_line_names_the_host_and_key_down_warms_up() {
    let logged = Logged::default();
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_ansi(false)
        .with_writer(logged.clone())
        .finish();
    let _guard = tracing::subscriber::set_default(subscriber);
    let mut harness = Harness::start(WAIT, vec![Script::Reply(CLEANED), Script::Reply(CLEANED)]);
    *harness.cleaner.host.lock().unwrap() = Some("InferenceNet".to_owned());
    harness.dictate().await;
    *harness.cleaner.host.lock().unwrap() = None;
    harness.dictate().await;
    let (_, cleaner) = harness.finish().await;
    // One warm-up per key-down; the spawned task has run by the end.
    assert_eq!(cleaner.warmed.load(std::sync::atomic::Ordering::SeqCst), 2);
    let log = String::from_utf8(logged.0.lock().unwrap().clone()).unwrap();
    let lines: Vec<&str> = log.lines().filter(|l| l.contains("cleanup")).collect();
    assert_eq!(lines.len(), 2, "{log}");
    assert!(
        lines[0].contains("provider=\"InferenceNet\""),
        "{}",
        lines[0]
    );
    assert!(!lines[1].contains("provider"), "{}", lines[1]);
}
