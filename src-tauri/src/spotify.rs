use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::Rng;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;

pub const SPOTIFY_REDIRECT_URI: &str = "http://127.0.0.1:41789/api/spotify/callback";

static PENDING_AUTH: Mutex<Option<PendingAuth>> = Mutex::new(None);

#[derive(Clone, Debug)]
pub struct PendingAuth {
    pub client_id: String,
    pub code_verifier: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpotifyTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyDeviceDto {
    pub id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub device_type: String,
    pub volume_percent: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyTrackDto {
    pub id: String,
    pub name: String,
    pub artist: String,
    pub album: String,
    pub album_art_url: Option<String>,
    pub duration_ms: i64,
    pub progress_ms: i64,
    pub is_playing: boolean_or_int::BoolOrInt,
    pub device: Option<SpotifyDeviceDto>,
}

// Module to handle Spotify's is_playing field safely
pub mod boolean_or_int {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct BoolOrInt(pub bool);

    impl Serialize for BoolOrInt {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: Serializer,
        {
            serializer.serialize_bool(self.0)
        }
    }

    impl<'de> Deserialize<'de> for BoolOrInt {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            let val = serde_json::Value::deserialize(deserializer)?;
            match val {
                serde_json::Value::Bool(b) => Ok(BoolOrInt(b)),
                serde_json::Value::Number(n) => Ok(BoolOrInt(n.as_i64().unwrap_or(0) != 0)),
                _ => Ok(BoolOrInt(false)),
            }
        }
    }
}

pub fn generate_pkce() -> (String, String) {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..64).map(|_| rng.gen::<u8>()).collect();
    let code_verifier = URL_SAFE_NO_PAD.encode(&bytes);

    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = URL_SAFE_NO_PAD.encode(&hash);

    (code_verifier, code_challenge)
}

pub fn start_auth_session(client_id: String) -> String {
    let (code_verifier, code_challenge) = generate_pkce();

    let mut lock = PENDING_AUTH.lock().unwrap();
    *lock = Some(PendingAuth {
        client_id: client_id.clone(),
        code_verifier,
    });

    let scopes = "user-read-playback-state user-modify-playback-state user-read-currently-playing";
    format!(
        "https://accounts.spotify.com/authorize?client_id={}&response_type=code&redirect_uri={}&code_challenge_method=S256&code_challenge={}&scope={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(SPOTIFY_REDIRECT_URI),
        urlencoding::encode(&code_challenge),
        urlencoding::encode(scopes)
    )
}

pub fn take_pending_auth() -> Option<PendingAuth> {
    let mut lock = PENDING_AUTH.lock().unwrap();
    lock.take()
}

pub async fn exchange_code(
    code: &str,
    client_id: &str,
    code_verifier: &str,
) -> Result<SpotifyTokenResponse, String> {
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", SPOTIFY_REDIRECT_URI),
        ("client_id", client_id),
        ("code_verifier", code_verifier),
    ];

    let resp = client
        .post("https://accounts.spotify.com/api/token")
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Spotify accounts: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Spotify token error: {}", text));
    }

    resp.json::<SpotifyTokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

pub async fn refresh_access_token(
    client_id: &str,
    refresh_token: &str,
) -> Result<SpotifyTokenResponse, String> {
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", client_id),
    ];

    let resp = client
        .post("https://accounts.spotify.com/api/token")
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to refresh Spotify token: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Spotify refresh error: {}", text));
    }

    resp.json::<SpotifyTokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse refresh response: {}", e))
}

/// Returns the Spotify account product for a token: "premium" | "free" | "open".
/// Used once per login (then persisted) to unlock Premium-only treatment.
pub async fn fetch_user_product(access_token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.spotify.com/v1/me")
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Network error fetching Spotify profile: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Spotify profile error ({}): {}", status, text));
    }

    let val = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse profile JSON: {}", e))?;

    Ok(val
        .get("product")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string())
}

pub async fn fetch_current_playback(
    access_token: &str,
) -> Result<Option<SpotifyTrackDto>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.spotify.com/v1/me/player")
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Network error connecting to Spotify player: {}", e))?;

    if resp.status().as_u16() == 204 {
        return Ok(None);
    }

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Spotify API error ({}): {}", status, text));
    }

    let val = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse player JSON: {}", e))?;

    let is_playing = val.get("is_playing").and_then(|v| v.as_bool()).unwrap_or(false);
    let progress_ms = val.get("progress_ms").and_then(|v| v.as_i64()).unwrap_or(0);

    let device = val.get("device").map(|d| SpotifyDeviceDto {
        id: d.get("id").and_then(|v| v.as_str()).map(String::from),
        name: d.get("name").and_then(|v| v.as_str()).unwrap_or("Spotify Device").to_string(),
        device_type: d.get("type").and_then(|v| v.as_str()).unwrap_or("Computer").to_string(),
        volume_percent: d.get("volume_percent").and_then(|v| v.as_i64()).map(|n| n as i32),
    });

    if let Some(item) = val.get("item") {
        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown Track").to_string();
        let duration_ms = item.get("duration_ms").and_then(|v| v.as_i64()).unwrap_or(0);

        let artist = item
            .get("artists")
            .and_then(|a| a.as_array())
            .and_then(|arr| arr.first())
            .and_then(|art| art.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("Unknown Artist")
            .to_string();

        let album = item
            .get("album")
            .and_then(|a| a.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("Unknown Album")
            .to_string();

        let album_art_url = item
            .get("album")
            .and_then(|a| a.get("images"))
            .and_then(|imgs| imgs.as_array())
            .and_then(|arr| arr.first())
            .and_then(|img| img.get("url"))
            .and_then(|u| u.as_str())
            .map(String::from);

        return Ok(Some(SpotifyTrackDto {
            id,
            name,
            artist,
            album,
            album_art_url,
            duration_ms,
            progress_ms,
            is_playing: boolean_or_int::BoolOrInt(is_playing),
            device,
        }));
    }

    Ok(None)
}

pub async fn execute_player_action(
    access_token: &str,
    action: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", access_token))
            .map_err(|e| e.to_string())?,
    );

    let (method, url) = match action {
        "PLAY" => (reqwest::Method::PUT, "https://api.spotify.com/v1/me/player/play"),
        "PAUSE" => (reqwest::Method::PUT, "https://api.spotify.com/v1/me/player/pause"),
        "NEXT" => (reqwest::Method::POST, "https://api.spotify.com/v1/me/player/next"),
        "PREVIOUS" => (reqwest::Method::POST, "https://api.spotify.com/v1/me/player/previous"),
        _ => return Err(format!("Unsupported Spotify action: {}", action)),
    };

    let resp = client
        .request(method, url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to send action to Spotify: {}", e))?;

    if !resp.status().is_success() && resp.status().as_u16() != 204 {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Action {} failed: {}", action, text));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_url_carries_all_query_params_intact() {
        // Regression test: the authorize URL must survive `cmd /c start`
        // on Windows, where a bare `&` would truncate the query string
        // (Spotify then errors with "response_type must be code").
        let url = start_auth_session("test-client-id-123".to_string());

        assert!(url.starts_with("https://accounts.spotify.com/authorize?"));

        // The query string must be one `?` + `&`-joined params — not cut short.
        let query = url.split('?').nth(1).expect("authorize URL has a query string");
        let parts: Vec<&str> = query.split('&').collect();
        assert_eq!(parts.len(), 6, "expected 6 query params, got: {}", query);

        let get = |key: &str| {
            parts
                .iter()
                .find(|p| p.starts_with(&format!("{}=", key)))
                .unwrap_or_else(|| panic!("missing query param '{}' in: {}", key, query))
                .trim_start_matches(&format!("{}=", key))
                .to_string()
        };

        assert_eq!(get("client_id"), "test-client-id-123");
        assert_eq!(get("response_type"), "code");
        assert_eq!(get("redirect_uri"), urlencoding::encode(SPOTIFY_REDIRECT_URI));
        assert_eq!(get("code_challenge_method"), "S256");
        assert!(!get("code_challenge").is_empty());
        assert!(get("scope").contains("user-read-playback-state"));

        // A fresh session stores the verifier for the later token exchange.
        assert!(take_pending_auth().is_some());
    }
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::new();
        for b in s.bytes() {
            match b {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(b as char);
                }
                _ => {
                    encoded.push_str(&format!("%{:02X}", b));
                }
            }
        }
        encoded
    }
}
