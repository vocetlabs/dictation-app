//! EVAL1: with a drafts log set (eval builds only), each transcribed
//! dictation records its raw transcript, the text handed on for the paste
//! and the cleanup outcome; without one (every other build) nothing is.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    reason = "test helpers fail the test on purpose"
)]

mod common;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use common::{CLEANED, FakeCleaner, RAW, Says, Script, TempWav, WAIT};
use dictation_core::coordinator::Phase::Idle;
use dictation_pipeline::eval_capture::DraftLog;
use dictation_pipeline::pipeline::{CleanupStep, Config, Extras, Pipeline, Ports, UiEvent};
use dictation_platform::fakes::{
    FakeClock, FakeHotkey, FakeInserter, FakePermissions, FileAudioSource,
};
use dictation_ports::HotkeyEvent;

/// One dictation with `extras`; the inserter, for what was pasted.
async fn dictate_once(extras: Extras) -> FakeInserter {
    let wav = TempWav::tone(300);
    let hotkey = FakeHotkey::new();
    let clock = FakeClock::at(Duration::from_secs(100));
    let inserter = FakeInserter::new();
    let ports = Ports {
        hotkey: hotkey.clone(),
        audio: FileAudioSource::new(wav.0.clone()),
        transcriber: Says,
        inserter: inserter.clone(),
        permissions: FakePermissions::all_granted(),
        clock: clock.clone(),
    };
    let (pipeline, mut ui) = Pipeline::spawn_with(ports, extras, Config::default()).unwrap();
    assert!(hotkey.emit(HotkeyEvent::Pressed));
    clock.advance(Duration::from_millis(500));
    assert!(hotkey.emit(HotkeyEvent::Released));
    loop {
        let event = tokio::time::timeout(WAIT, ui.recv())
            .await
            .expect("no UI event in time")
            .expect("pipeline stopped");
        if event == UiEvent::StateChanged(Idle) {
            break;
        }
    }
    pipeline.shutdown().await;
    inserter
}

fn collecting() -> (DraftLog, Arc<Mutex<Vec<serde_json::Value>>>) {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&lines);
    let log = DraftLog::new(move |line| {
        sink.lock()
            .unwrap()
            .push(serde_json::from_str(line).unwrap());
    });
    (log, lines)
}

#[tokio::test]
async fn eval1_a_cleaned_dictation_records_raw_final_and_outcome() {
    let cleaner = FakeCleaner::default();
    cleaner
        .scripts
        .lock()
        .unwrap()
        .push_back(Script::Reply(CLEANED));
    let (drafts, lines) = collecting();
    let inserter = dictate_once(Extras {
        cleanup: Some(CleanupStep::new(cleaner).with_timeout(WAIT)),
        drafts: Some(drafts),
        ..Extras::default()
    })
    .await;
    assert_eq!(inserter.inserted(), [CLEANED], "the paste is unchanged");
    let lines = lines.lock().unwrap();
    assert_eq!(lines.len(), 1, "one line per dictation");
    assert_eq!(lines[0]["raw"], RAW);
    assert_eq!(lines[0]["final"], CLEANED);
    assert_eq!(lines[0]["cleanup"], "applied");
}

#[tokio::test]
async fn eval1_a_fallback_records_the_raw_text_as_final() {
    let cleaner = FakeCleaner::default();
    cleaner.scripts.lock().unwrap().push_back(Script::Hang);
    let (drafts, lines) = collecting();
    dictate_once(Extras {
        cleanup: Some(CleanupStep::new(cleaner).with_timeout(Duration::from_millis(50))),
        drafts: Some(drafts),
        ..Extras::default()
    })
    .await;
    let lines = lines.lock().unwrap();
    assert_eq!(lines.len(), 1);
    assert_eq!(
        (&lines[0]["raw"], &lines[0]["final"]),
        (&RAW.into(), &RAW.into())
    );
    assert_eq!(lines[0]["cleanup"], "fallback_timeout");
}

#[tokio::test]
async fn eval1_without_cleanup_the_outcome_is_null() {
    let (drafts, lines) = collecting();
    dictate_once(Extras {
        drafts: Some(drafts),
        ..Extras::default()
    })
    .await;
    let lines = lines.lock().unwrap();
    assert_eq!(lines.len(), 1);
    assert_eq!(lines[0]["final"], RAW);
    assert!(lines[0]["cleanup"].is_null());
}
