//! EVAL1: the eval builds' drafts file, one JSON line per dictation, private
//! to this user. Only the shell's `eval-capture` builds create one.

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// Appends lines to a file that only this user can read.
#[derive(Debug, Clone)]
pub struct DraftsFile {
    path: PathBuf,
}

impl DraftsFile {
    /// The file at `path`, created (with its folder) on the first append.
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    /// Where the lines go.
    #[must_use]
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Appends `line` and a newline. A new file is readable and writable by
    /// this user only from the moment it exists (0600, in a 0700 folder); an
    /// existing one is made so first.
    ///
    /// # Errors
    ///
    /// If the folder or file can't be created, made private or written.
    pub fn append(&self, line: &str) -> io::Result<()> {
        if let Some(dir) = self.path.parent() {
            create_private_dir(dir)?;
        }
        let mut options = OpenOptions::new();
        options.append(true).create(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&self.path)?;
        make_private(&self.path)?;
        let mut bytes = Vec::with_capacity(line.len() + 1);
        bytes.extend_from_slice(line.as_bytes());
        bytes.push(b'\n');
        file.write_all(&bytes)
    }
}

/// Creates `dir` (0700) if needed; an existing one, made by hand or before
/// this check, is tightened to 0700 too. Its parents are left as they are.
fn create_private_dir(dir: &Path) -> io::Result<()> {
    let mut builder = fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if fs::metadata(dir)?.permissions().mode() & 0o777 != 0o700 {
            fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
        }
    }
    Ok(())
}

#[cfg(unix)]
fn make_private(path: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    if fs::metadata(path)?.permissions().mode() & 0o777 == 0o600 {
        return Ok(());
    }
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
}

#[cfg(not(unix))]
#[allow(
    clippy::unnecessary_wraps,
    reason = "the same shape as the unix version"
)]
fn make_private(_path: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, reason = "tests")]

    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "dictation-drafts-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn lines_are_appended_one_per_call() {
        let dir = temp_dir();
        let file = DraftsFile::new(dir.join("eval").join("drafts.jsonl"));
        file.append("{\"a\":1}").unwrap();
        file.append("{\"a\":2}").unwrap();
        assert_eq!(
            fs::read_to_string(file.path()).unwrap(),
            "{\"a\":1}\n{\"a\":2}\n"
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn the_file_and_its_folder_are_private() {
        use std::os::unix::fs::PermissionsExt;
        let mode = |p: &Path| fs::metadata(p).unwrap().permissions().mode() & 0o777;
        let dir = temp_dir();
        let path = dir.join("eval").join("drafts.jsonl");
        let file = DraftsFile::new(&path);
        file.append("x").unwrap();
        assert_eq!(mode(&path), 0o600);
        assert_eq!(mode(path.parent().unwrap()), 0o700);
        // An existing folder open to others is tightened too.
        fs::set_permissions(path.parent().unwrap(), fs::Permissions::from_mode(0o755)).unwrap();
        file.append("z").unwrap();
        assert_eq!(mode(path.parent().unwrap()), 0o700);
        // A file opened to others (a copy, a backup) is made private again.
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        file.append("y").unwrap();
        assert_eq!(mode(&path), 0o600);
        fs::remove_dir_all(&dir).unwrap();
    }
}
