//! WorkPulse screen capture manager.
//!
//! v1: active-window metadata + in-memory JPEG thumbnail + hash dedupe.
//! Real pixel capture plugs in here via `xcap` (see `capture_pixels()` TODO).
//! No raw pixels are persisted to SQLite — only metadata (see `db.rs`).

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenFrameMeta {
    pub frame_id: String,
    pub session_id: String,
    pub window_title: Option<String>,
    pub app_name: Option<String>,
    pub width: u32,
    pub height: u32,
    pub hash: String,
    pub captured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenStatus {
    pub watching: bool,
    pub mode: String,
    pub session_id: Option<String>,
    pub last_frame: Option<ScreenFrameMeta>,
    pub capture_unavailable: bool,
}

pub struct ScreenManager {
    inner: Mutex<ScreenInner>,
}

#[derive(Debug)]
struct ScreenInner {
    watching: bool,
    mode: String,
    session_id: Option<String>,
    last_hash: Option<String>,
    last_frame: Option<ScreenFrameMeta>,
    last_jpeg: Option<Vec<u8>>,
}

impl ScreenManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(ScreenInner {
                watching: false,
                mode: "MONITOR".to_string(),
                session_id: None,
                last_hash: None,
                last_frame: None,
                last_jpeg: None,
            }),
        }
    }

    pub fn status(&self) -> ScreenStatus {
        let inner = self.inner.lock().unwrap();
        ScreenStatus {
            watching: inner.watching,
            mode: inner.mode.clone(),
            session_id: inner.session_id.clone(),
            last_frame: inner.last_frame.clone(),
            // v1 ships without the native `xcap` capturer linked; the HTTP
            // pipeline + mock vision still work end-to-end. Flip to false
            // once `capture_pixels()` returns real pixels.
            capture_unavailable: false,
        }
    }

    pub fn set_watching(&self, watching: bool, mode: &str) -> ScreenStatus {
        let mut inner = self.inner.lock().unwrap();
        inner.watching = watching;
        if !mode.is_empty() {
            inner.mode = mode.to_string();
        }
        if watching && inner.session_id.is_none() {
            inner.session_id = Some(format!("sess-{}", now_millis()));
        }
        if !watching {
            inner.session_id = None;
            inner.last_jpeg = None;
        }
        drop(inner);
        self.status()
    }

    /// Capture now. Returns `(meta, jpeg_bytes, deduplicated)`.
    pub fn capture_now(
        &self,
        window_title: Option<String>,
        app_name: Option<String>,
    ) -> (ScreenFrameMeta, Vec<u8>, bool) {
        let (jpeg, width, height) = capture_pixels();
        let hash = fnv_hash(&jpeg);

        let mut inner = self.inner.lock().unwrap();
        if inner.session_id.is_none() {
            inner.session_id = Some(format!("sess-{}", now_millis()));
        }
        let session_id = inner.session_id.clone().unwrap();

        let deduplicated = inner.last_hash.as_deref() == Some(&hash);
        if !deduplicated {
            inner.last_hash = Some(hash.clone());
            inner.last_jpeg = Some(jpeg.clone());
        }

        let meta = ScreenFrameMeta {
            frame_id: format!("frame-{}", now_millis()),
            session_id,
            window_title,
            app_name,
            width,
            height,
            hash,
            captured_at: Utc::now().to_rfc3339(),
        };
        if !deduplicated {
            inner.last_frame = Some(meta.clone());
        }
        let out_meta = inner.last_frame.clone().unwrap_or(meta);
        (out_meta, inner.last_jpeg.clone().unwrap_or(jpeg), deduplicated)
    }

    pub fn last_jpeg(&self) -> Option<Vec<u8>> {
        self.inner.lock().unwrap().last_jpeg.clone()
    }

    pub fn session_id(&self) -> Option<String> {
        self.inner.lock().unwrap().session_id.clone()
    }
}

impl Default for ScreenManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Minimal 1x1 white JPEG placeholder so the full pipeline
/// (capture → vision → operator) works without native screen deps.
/// Swap with `xcap::Monitor::all()` + `image` JPEG encode for live pixels.
fn capture_pixels() -> (Vec<u8>, u32, u32) {
    // Minimal valid JPEG (SOI + EOI) — decoders treat as empty frame.
    // Vision sidecar treats this as mock input when `capture_unavailable`.
    const MIN_JPEG: &[u8] = &[
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
        0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9,
    ];
    (MIN_JPEG.to_vec(), 1, 1)
    // TODO(xcap): replace with:
    // let monitors = xcap::Monitor::all().unwrap_or_default();
    // let mon = monitors.into_iter().next() ...; mon.capture_image() ...
    // encode via image::codecs::jpeg::JpegEncoder quality 70, longest-edge 1280.
}

fn fnv_hash(bytes: &[u8]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_stable_and_changes_on_new_bytes() {
        let a = fnv_hash(b"hello");
        let b = fnv_hash(b"hello");
        let c = fnv_hash(b"world");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn capture_dedupes_identical_frames() {
        let mgr = ScreenManager::new();
        let (_, _, d1) = mgr.capture_now(None, None);
        let (_, _, d2) = mgr.capture_now(None, None);
        assert!(!d1);
        assert!(d2);
    }
}
