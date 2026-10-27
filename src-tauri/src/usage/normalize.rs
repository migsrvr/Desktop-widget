use super::model::{source, ProviderSnapshot, UsageStatus, UsageWindow};
use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::Value;

fn percent(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .filter(|n| n.is_finite() && (0.0..=100.0).contains(n))
}
fn amount(value: &Value) -> Option<f64> {
    value.as_f64().filter(|n| n.is_finite() && *n >= 0.0)
}
fn short(value: &Value) -> Option<String> {
    value
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(80).collect())
}

fn reset(value: &Value) -> Option<String> {
    if let Some(seconds) = value.as_i64() {
        return DateTime::<Utc>::from_timestamp(seconds, 0)
            .map(|t| t.to_rfc3339_opts(SecondsFormat::Secs, true));
    }
    value
        .as_str()
        .and_then(|text| DateTime::parse_from_rfc3339(text).ok())
        .map(|t| t.to_rfc3339_opts(SecondsFormat::Secs, true))
}

fn window_label(minutes: Option<u64>, fallback: &str) -> String {
    match minutes {
        Some(10080) => "Weekly".into(),
        Some(300) => "5-hour".into(),
        Some(n) if n >= 1440 && n % 1440 == 0 => format!("{}-day", n / 1440),
        Some(n) if n >= 60 && n % 60 == 0 => format!("{}-hour", n / 60),
        Some(n) => format!("{}-minute", n),
        None => fallback.into(),
    }
}

fn reading(
    provider: &str,
    windows: Vec<UsageWindow>,
    plan: Option<String>,
    received_at: &str,
) -> Option<ProviderSnapshot> {
    if windows.is_empty() {
        return None;
    }
    let available = windows
        .iter()
        .any(|w| w.used_percent.is_some() || w.remaining_amount.is_some());
    Some(ProviderSnapshot {
        revision: 0,
        provider: provider.into(),
        source: source(provider).into(),
        status: if available {
            UsageStatus::Current
        } else {
            UsageStatus::Waiting
        },
        windows,
        plan,
        received_at: Some(received_at.into()),
        detail: if available {
            None
        } else {
            Some("The provider reported quota windows without allowance values. Waiting for a usable reading.".into())
        },
    })
}

pub fn codex_reading(input: &Value, received_at: &str) -> Option<ProviderSnapshot> {
    let mut windows = Vec::new();
    let mut plan = None;
    let buckets: Vec<(String, &Value)> = if let Some(map) = input
        .get("rateLimitsByLimitId")
        .and_then(Value::as_object)
        .filter(|m| !m.is_empty())
    {
        map.iter()
            .map(|(id, value)| (id.chars().take(100).collect(), value))
            .collect()
    } else {
        let value = input.get("rateLimits")?;
        vec![(
            value
                .get("limitId")
                .and_then(Value::as_str)
                .unwrap_or("codex")
                .chars()
                .take(100)
                .collect(),
            value,
        )]
    };
    let multiple = buckets.len() > 1;
    for (bucket, value) in buckets.into_iter().take(32) {
        if plan.is_none() {
            plan = short(&value["planType"]);
        }
        for (key, fallback) in [("primary", "Session"), ("secondary", "Longer window")] {
            let window = &value[key];
            if !window.is_object() {
                continue;
            }
            let used = percent(&window["usedPercent"]);
            let label = window_label(window["windowDurationMins"].as_u64(), fallback);
            let label = if multiple {
                format!(
                    "{} · {}",
                    short(&value["limitName"]).unwrap_or_else(|| bucket.clone()),
                    label
                )
            } else {
                label
            };
            windows.push(UsageWindow {
                id: format!("{bucket}:{key}"),
                label,
                used_percent: used,
                remaining_amount: None,
                unit: None,
                reset_at: reset(&window["resetsAt"]),
            });
        }
    }
    reading("codex", windows, plan, received_at)
}

pub fn statusline_reading(
    provider: &str,
    input: &Value,
    received_at: &str,
) -> Option<ProviderSnapshot> {
    match provider {
        "claude" => {
            let limits = input.get("rate_limits")?.as_object()?;
            let mut windows = Vec::new();
            for (id, label) in [("five_hour", "5-hour"), ("seven_day", "Weekly")] {
                let Some(value) = limits.get(id) else {
                    continue;
                };
                if !value.is_object() {
                    continue;
                }
                let used = percent(&value["used_percentage"]);
                windows.push(UsageWindow {
                    id: id.into(),
                    label: label.into(),
                    used_percent: used,
                    remaining_amount: None,
                    unit: None,
                    reset_at: reset(&value["resets_at"]),
                });
            }
            reading("claude", windows, None, received_at)
        }
        "antigravity" | "gemini" => {
            let quota = input.get("quota")?.as_object()?;
            let mut windows = Vec::new();
            for (id, value) in quota.iter().take(128) {
                // Partner-model quotas belong to Antigravity, never to Claude Code.
                if !(id == "gemini" || id.starts_with("gemini-") || id.starts_with("gemini_"))
                    || !value.is_object()
                    || value["disabled"].as_bool() == Some(true)
                {
                    continue;
                }
                let used = value["remaining_fraction"]
                    .as_f64()
                    .filter(|n| n.is_finite() && (0.0..=1.0).contains(n))
                    .map(|n| ((1.0 - n) * 10000.0).round() / 100.0);
                let remaining_amount = amount(&value["remaining_amount"]);
                let label = if id.contains("weekly") {
                    "Weekly".into()
                } else if id.contains("five") || id.contains("5h") {
                    "5-hour".into()
                } else {
                    id.chars().take(120).collect()
                };
                // Relative reset time alone cannot establish an authoritative absolute reset.
                windows.push(UsageWindow {
                    id: id.chars().take(160).collect(),
                    label,
                    used_percent: used,
                    remaining_amount,
                    unit: short(&value["unit"]),
                    reset_at: reset(&value["reset_time"]),
                });
                if windows.len() == 64 {
                    break;
                }
            }
            reading("gemini", windows, short(&input["plan_tier"]), received_at)
        }
        _ => None,
    }
}
