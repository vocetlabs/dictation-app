//! EVAL1: an eval build (`--features eval-capture`, off by default, never in
//! a release) saves each dictation's raw transcript, final text and cleanup
//! outcome to `<app data>/eval/drafts.jsonl`, private to this user, for the
//! bench. The texts are never logged. Every other build records nothing.

use std::path::Path;

use dictation_pipeline::eval_capture::DraftLog;

/// The drafts log of an eval build, `None` in every other build.
#[cfg(feature = "eval-capture")]
pub fn drafts(data_dir: &Path) -> Option<DraftLog> {
    let file = dictation_platform::drafts_file::DraftsFile::new(
        data_dir.join("eval").join("drafts.jsonl"),
    );
    tracing::info!(
        path = %file.path().display(),
        "eval build: saving each dictation's raw and final text"
    );
    Some(DraftLog::new(move |line| {
        if let Err(error) = file.append(line) {
            tracing::warn!(%error, "eval build: could not save a dictation's drafts");
        }
    }))
}

/// The drafts log of an eval build, `None` in every other build.
#[cfg(not(feature = "eval-capture"))]
pub fn drafts(_data_dir: &Path) -> Option<DraftLog> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The feature is never on unless asked for: not a default feature, and
    /// nothing that builds a release or the DMG passes it.
    #[test]
    fn eval_capture_is_off_by_default_and_never_in_a_release() {
        let manifest = include_str!("../Cargo.toml");
        let default = manifest
            .lines()
            .map(str::trim)
            .find(|line| line.starts_with("default"));
        assert!(
            default.is_none_or(|line| !line.contains("eval-capture")),
            "eval-capture must not be a default feature: {default:?}"
        );
        assert!(manifest.contains("eval-capture = []"), "the feature exists");
        for (name, text) in [
            (
                "scripts/release.sh",
                include_str!("../../scripts/release.sh"),
            ),
            (
                "scripts/build-dmg.sh",
                include_str!("../../scripts/build-dmg.sh"),
            ),
            (
                "src-tauri/tauri.conf.json",
                include_str!("../tauri.conf.json"),
            ),
            ("package.json", include_str!("../../package.json")),
            (
                ".github/workflows/ci.yml",
                include_str!("../../.github/workflows/ci.yml"),
            ),
        ] {
            assert!(
                !text.contains("eval-capture"),
                "{name} must not enable eval-capture"
            );
        }
    }

    #[cfg(not(feature = "eval-capture"))]
    #[test]
    fn a_normal_build_records_nothing() {
        assert!(drafts(Path::new("/nonexistent")).is_none());
    }

    #[cfg(feature = "eval-capture")]
    #[test]
    fn an_eval_build_saves_one_private_line_per_dictation() {
        let dir = std::env::temp_dir().join(format!("eval-capture-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let log = drafts(&dir).expect("an eval build records");
        log.record("um, hi", "Hi.", None);
        let text =
            std::fs::read_to_string(dir.join("eval").join("drafts.jsonl")).unwrap_or_default();
        assert_eq!(text.lines().count(), 1, "one line");
        assert!(text.contains("\"raw\":\"um, hi\""));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
