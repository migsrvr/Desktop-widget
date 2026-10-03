#[cfg(target_os = "windows")]
mod win32 {
    #[link(name = "user32")]
    extern "system" {
        pub fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
        pub fn EnumWindows(
            lp_enum_func: unsafe extern "system" fn(hwnd: isize, lparam: isize) -> i32,
            lparam: isize,
        ) -> i32;
        pub fn GetWindowTextW(hwnd: isize, lp_string: *mut u16, n_max_count: i32) -> i32;
        pub fn GetWindowTextLengthW(hwnd: isize) -> i32;
        pub fn GetWindowThreadProcessId(hwnd: isize, lpdw_process_id: *mut u32) -> u32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> isize;
        pub fn CloseHandle(h_object: isize) -> i32;
        pub fn K32GetProcessImageFileNameW(
            h_process: isize,
            lp_image_file_name: *mut u16,
            n_size: u32,
        ) -> u32;
    }
}

#[derive(Debug, Clone)]
pub struct LocalTrackInfo {
    pub artist: String,
    pub title: String,
    pub is_playing: bool,
}

/// Send native Windows hardware media keys to control Spotify Free (or any active player)
pub fn send_media_key(action: &str) {
    #[cfg(target_os = "windows")]
    unsafe {
        let vk: u8 = match action {
            "NEXT" => 0xB0,        // VK_MEDIA_NEXT_TRACK
            "PREVIOUS" => 0xB1,    // VK_MEDIA_PREV_TRACK
            "PLAY" | "PAUSE" | "TOGGLE" => 0xB3, // VK_MEDIA_PLAY_PAUSE
            _ => return,
        };

        // Key Down
        win32::keybd_event(vk, 0, 0, 0);
        // Key Up
        win32::keybd_event(vk, 0, 0x0002, 0);
    }
}

#[cfg(target_os = "windows")]
struct EnumContext {
    result: Option<LocalTrackInfo>,
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_proc(hwnd: isize, lparam: isize) -> i32 {
    let ctx = &mut *(lparam as *mut EnumContext);

    // If we already found an actively playing track, stop enumerating
    if let Some(ref r) = ctx.result {
        if r.is_playing {
            return 0; // stop
        }
    }

    let len = win32::GetWindowTextLengthW(hwnd);
    if len <= 0 {
        return 1; // continue
    }

    // Check process name
    let mut pid: u32 = 0;
    win32::GetWindowThreadProcessId(hwnd, &mut pid);
    if pid == 0 {
        return 1;
    }

    let h_process = win32::OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, 0, pid);
    if h_process == 0 {
        return 1;
    }

    let mut img_buf = [0u16; 512];
    let img_len = win32::K32GetProcessImageFileNameW(h_process, img_buf.as_mut_ptr(), 512);
    win32::CloseHandle(h_process);

    if img_len == 0 {
        return 1;
    }

    let img_name = String::from_utf16_lossy(&img_buf[..img_len as usize]).to_lowercase();
    if !img_name.ends_with("spotify.exe") {
        return 1;
    }

    // Read window title
    let mut title_buf = vec![0u16; (len + 2) as usize];
    let read_len = win32::GetWindowTextW(hwnd, title_buf.as_mut_ptr(), (len + 1) as i32);
    if read_len <= 0 {
        return 1;
    }

    let title = String::from_utf16_lossy(&title_buf[..read_len as usize]);
    let title_trim = title.trim();

    // Ignore known system/internal helper titles
    if title_trim.is_empty()
        || title_trim == "Default IME"
        || title_trim == "MSCTFIME UI"
        || title_trim == "GDI+ Window"
    {
        return 1;
    }

    // When Spotify is paused or idle, title is "Spotify", "Spotify Free", or "Spotify Premium"
    if title_trim.eq_ignore_ascii_case("spotify")
        || title_trim.eq_ignore_ascii_case("spotify free")
        || title_trim.eq_ignore_ascii_case("spotify premium")
    {
        if ctx.result.is_none() {
            ctx.result = Some(LocalTrackInfo {
                artist: String::new(),
                title: "Spotify (Paused)".to_string(),
                is_playing: false,
            });
        }
        return 1;
    }

    // When Spotify is playing, format is: "Artist - Song Title"
    if let Some((artist, track_name)) = title_trim.split_once(" - ") {
        ctx.result = Some(LocalTrackInfo {
            artist: artist.trim().to_string(),
            title: track_name.trim().to_string(),
            is_playing: true,
        });
        return 0; // Found active playing track, stop enumeration
    }

    1
}

/// Detects the current track directly from the Windows desktop Spotify application
pub fn detect_spotify_playback() -> Option<LocalTrackInfo> {
    #[cfg(target_os = "windows")]
    {
        let mut ctx = EnumContext { result: None };
        unsafe {
            win32::EnumWindows(enum_windows_proc, &mut ctx as *mut _ as isize);
        }
        ctx.result
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

static ARTWORK_CACHE: std::sync::Mutex<Option<(String, Option<String>)>> = std::sync::Mutex::new(None);

/// Builds a rich SpotifyTrackDto from the local Windows Spotify application with album art
pub async fn get_local_spotify_track() -> Option<crate::spotify::SpotifyTrackDto> {
    let local = detect_spotify_playback()?;

    if local.title.is_empty() && local.artist.is_empty() {
        return None;
    }

    let cache_key = format!("{} - {}", local.artist, local.title);
    let mut album_art_url = None;

    {
        if let Ok(cache) = ARTWORK_CACHE.lock() {
            if let Some((ref key, ref art)) = *cache {
                if key == &cache_key {
                    album_art_url = art.clone();
                }
            }
        }
    }

    // If not cached and we have an artist and title, fetch high-res artwork from public index
    if album_art_url.is_none() && !local.artist.is_empty() && !local.title.is_empty() {
        let query = format!("{} {}", local.artist, local.title);
        let client = reqwest::Client::new();
        let url = format!(
            "https://itunes.apple.com/search?term={}&media=music&entity=song&limit=1",
            urlencoding::encode(&query)
        );
        if let Ok(resp) = client.get(&url).timeout(std::time::Duration::from_millis(1500)).send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(art) = json
                    .get("results")
                    .and_then(|r| r.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|first| first.get("artworkUrl100"))
                    .and_then(|u| u.as_str())
                {
                    let high_res = art.replace("100x100bb.jpg", "300x300bb.jpg");
                    album_art_url = Some(high_res.clone());
                    if let Ok(mut cache) = ARTWORK_CACHE.lock() {
                        *cache = Some((cache_key.clone(), Some(high_res)));
                    }
                }
            }
        }
    }

    Some(crate::spotify::SpotifyTrackDto {
        id: format!("local-{}", local.title.replace(' ', "-").to_lowercase()),
        name: local.title,
        artist: if local.artist.is_empty() {
            "Spotify".to_string()
        } else {
            local.artist
        },
        album: "Spotify Free (Desktop)".to_string(),
        album_art_url,
        duration_ms: 0,
        progress_ms: 0,
        is_playing: crate::spotify::boolean_or_int::BoolOrInt(local.is_playing),
        device: Some(crate::spotify::SpotifyDeviceDto {
            id: Some("desktop-app".to_string()),
            name: "Spotify App (Windows)".to_string(),
            device_type: "Computer".to_string(),
            volume_percent: Some(100),
        }),
    })
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::new();
        for b in s.bytes() {
            match b {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(b as char);
                }
                b' ' => {
                    encoded.push('+');
                }
                _ => {
                    encoded.push_str(&format!("%{:02X}", b));
                }
            }
        }
        encoded
    }
}

