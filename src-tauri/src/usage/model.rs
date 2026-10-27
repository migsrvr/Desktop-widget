use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const PROVIDERS: [&str; 3] = ["codex", "claude", "gemini"];
pub const MAX_AGE_MS: i64 = 15 * 60 * 1000;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub id: String,
    pub label: String,
    pub used_percent: Option<f64>,
    pub remaining_amount: Option<f64>,
    pub unit: Option<String>,
    pub reset_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum UsageStatus {
    NotConnected,
    Waiting,
    Current,
    Stale,
    Error,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSnapshot {
    #[serde(default)]
    pub revision: u64,
    pub provider: String,
    pub source: String,
    pub status: UsageStatus,
    pub windows: Vec<UsageWindow>,
    pub plan: Option<String>,
    pub received_at: Option<String>,
    pub detail: Option<String>,
}

pub type UsageSnapshot = BTreeMap<String, ProviderSnapshot>;

pub fn source(provider: &str) -> &'static str {
    match provider {
        "codex" => "codex-app-server",
        "claude" => "claude-statusline",
        _ => "antigravity-statusline",
    }
}

pub fn empty(provider: &str) -> ProviderSnapshot {
    ProviderSnapshot {
        revision: 0,
        provider: provider.into(),
        source: source(provider).into(),
        status: UsageStatus::NotConnected,
        windows: vec![],
        plan: None,
        received_at: None,
        detail: None,
    }
}

pub fn empty_snapshot() -> UsageSnapshot {
    PROVIDERS
        .iter()
        .map(|p| (p.to_string(), empty(p)))
        .collect()
}

pub fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
pub fn millis(value: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date| date.timestamp_millis())
}

pub fn effective_status(reading: &ProviderSnapshot, timestamp: i64) -> UsageStatus {
    if !matches!(reading.status, UsageStatus::Current | UsageStatus::Stale) {
        return reading.status.clone();
    }
    let age = reading
        .received_at
        .as_deref()
        .and_then(millis)
        .map(|time| timestamp - time);
    if !matches!(age, Some(value) if (-60_000..=MAX_AGE_MS).contains(&value)) {
        return UsageStatus::Stale;
    }
    if !reading.windows.is_empty()
        && reading.windows.iter().all(|w| {
            w.reset_at
                .as_deref()
                .and_then(millis)
                .is_some_and(|reset| reset <= timestamp)
        })
    {
        return UsageStatus::Stale;
    }
    reading.status.clone()
}

pub fn valid_reading(reading: &ProviderSnapshot, provider: &str) -> bool {
    PROVIDERS.contains(&provider)
        && reading.provider == provider
        && reading.source == source(provider)
        && reading.received_at.as_deref().and_then(millis).is_some()
        && !reading.windows.is_empty()
        && reading.windows.len() <= 64
        && reading.windows.iter().all(|w| {
            !w.id.is_empty()
                && w.id.len() <= 160
                && w.label.len() <= 160
                && w.used_percent
                    .is_none_or(|n| n.is_finite() && (0.0..=100.0).contains(&n))
                && w.remaining_amount.is_none_or(|n| n.is_finite() && n >= 0.0)
                && w.reset_at.as_deref().is_none_or(|s| millis(s).is_some())
        })
}
