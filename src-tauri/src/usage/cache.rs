use super::model::{millis, valid_reading, ProviderSnapshot};
use serde::{de::DeserializeOwned, Serialize};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};

#[derive(Clone)]
pub struct UsagePaths {
    pub root: PathBuf,
}
impl UsagePaths {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
    pub fn discover() -> Result<Self, String> {
        let base =
            dirs::data_local_dir().ok_or("Local application data directory is unavailable")?;
        Ok(Self::new(base.join("SESSION").join("usage")))
    }
    pub fn reading(&self, provider: &str) -> PathBuf {
        self.root.join(format!("{provider}.json"))
    }
    pub fn integration(&self, provider: &str) -> PathBuf {
        self.root.join(format!("{provider}.integration.json"))
    }
    pub fn preferences(&self) -> PathBuf {
        self.root.join("preferences.json")
    }
}

pub fn private_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|_| "Could not create the private usage directory")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Could not protect the usage directory")?;
    }
    Ok(())
}

pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Could not read the usage file".into()),
    };
    let mut bytes = Vec::new();
    file.take(1_048_577)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read the usage file")?;
    if bytes.len() > 1_048_576 {
        return Err("Usage file exceeds the supported size".into());
    }
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| "Usage file is incomplete or invalid".into())
}

pub fn atomic_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let parent = path.parent().ok_or("Invalid usage file location")?;
    private_directory(parent)?;
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid usage file name")?;
    let temporary = parent.join(format!(
        ".{name}.{}.{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| {
        let bytes =
            serde_json::to_vec_pretty(value).map_err(|_| "Could not serialize usage settings")?;
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|_| "Could not write the usage file")?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Could not finish writing the usage file")?;
        drop(file);
        fs::rename(&temporary, path).map_err(|_| "Could not atomically replace the usage file")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub struct FileLock {
    path: PathBuf,
}
impl FileLock {
    pub fn acquire(paths: &UsagePaths, provider: &str) -> Result<Self, String> {
        if !super::model::PROVIDERS.contains(&provider) {
            return Err("Unknown usage provider".into());
        }
        private_directory(&paths.root)?;
        let path = paths.root.join(format!("{provider}.lock"));
        let start = Instant::now();
        loop {
            match fs::create_dir(&path) {
                Ok(()) => return Ok(Self { path }),
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                    // Exporters never hold a lock for more than a few milliseconds. Recover after a crashed process.
                    if fs::metadata(&path)
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.elapsed().ok())
                        .is_some_and(|age| age > Duration::from_secs(30))
                    {
                        let _ = fs::remove_dir(&path);
                    }
                    if start.elapsed() >= Duration::from_secs(1) {
                        return Err("Another usage operation is still running; try again".into());
                    }
                    std::thread::sleep(Duration::from_millis(10));
                }
                Err(_) => return Err("Could not lock the usage settings".into()),
            }
        }
    }
}
impl Drop for FileLock {
    fn drop(&mut self) {
        let _ = fs::remove_dir(&self.path);
    }
}

pub fn load_reading(
    paths: &UsagePaths,
    provider: &str,
) -> Result<Option<ProviderSnapshot>, String> {
    let value: Option<ProviderSnapshot> = read_json(&paths.reading(provider))?;
    match value {
        Some(reading) if valid_reading(&reading, provider) => Ok(Some(reading)),
        Some(_) => Err("Usage cache has invalid quota data".into()),
        None => Ok(None),
    }
}

pub fn save_reading(paths: &UsagePaths, reading: &ProviderSnapshot) -> Result<bool, String> {
    if !valid_reading(reading, &reading.provider) {
        return Err("Invalid provider reading".into());
    }
    let _lock = FileLock::acquire(paths, &reading.provider)?;
    if let Some(record) = super::settings::load_record(paths, &reading.provider)? {
        if !record.enabled {
            return Ok(false);
        }
    }
    if let Some(existing) = load_reading(paths, &reading.provider).ok().flatten() {
        if existing.windows == reading.windows && existing.plan == reading.plan {
            return Ok(false);
        }
        if existing.received_at.as_deref().and_then(millis)
            > reading.received_at.as_deref().and_then(millis)
        {
            return Ok(false);
        }
    }
    atomic_json(&paths.reading(&reading.provider), reading)?;
    Ok(true)
}
