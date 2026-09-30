use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tokio::sync::broadcast;

pub fn start_transcript_watcher(tx: broadcast::Sender<String>) {
    tokio::spawn(async move {
        let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Miggy"));
        let brain_dir = home_dir.join(".gemini").join("antigravity-ide").join("brain");

        let mut last_step_index: i64 = -1;
        let mut last_action = String::new();

        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            if let Ok(entries) = fs::read_dir(&brain_dir) {
                let mut latest_file: Option<PathBuf> = None;
                let mut latest_mtime = std::time::SystemTime::UNIX_EPOCH;

                for entry in entries.flatten() {
                    let log_file = entry
                        .path()
                        .join(".system_generated")
                        .join("logs")
                        .join("transcript.jsonl");

                    if log_file.exists() {
                        if let Ok(metadata) = fs::metadata(&log_file) {
                            if let Ok(mtime) = metadata.modified() {
                                if mtime > latest_mtime {
                                    latest_mtime = mtime;
                                    latest_file = Some(log_file);
                                }
                            }
                        }
                    }
                }

                if let Some(file_path) = latest_file {
                    if let Ok(content) = fs::read_to_string(&file_path) {
                        let lines: Vec<&str> = content
                            .trim()
                            .split('\n')
                            .filter(|s| !s.is_empty())
                            .collect();

                        if let Some(last_line) = lines.last() {
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(last_line) {
                                let step_idx = val
                                    .get("step_index")
                                    .and_then(|v| v.as_i64())
                                    .unwrap_or(-1);

                                if step_idx != last_step_index {
                                    last_step_index = step_idx;

                                    let mut description = "Working on task...".to_string();
                                    let mut status = "WORKING".to_string();

                                    if let Some(tool_calls) =
                                        val.get("tool_calls").and_then(|v| v.as_array())
                                    {
                                        if let Some(first_tc) = tool_calls.first() {
                                            if let Some(args) = first_tc.get("args") {
                                                if let Some(act) = args
                                                    .get("toolAction")
                                                    .and_then(|v| v.as_str())
                                                {
                                                    description = act.replace('\"', "").to_string();
                                                } else if let Some(sum) = args
                                                    .get("toolSummary")
                                                    .and_then(|v| v.as_str())
                                                {
                                                    description = sum.replace('\"', "").to_string();
                                                }
                                            }
                                            status = "RUNNING_TOOLS".to_string();
                                        }
                                    } else if let Some(t) =
                                        val.get("type").and_then(|v| v.as_str())
                                    {
                                        if t == "PLANNER_RESPONSE" {
                                            if val.get("content").is_some() {
                                                description =
                                                    "Waiting for your next task".to_string();
                                                status = "WAITING_INPUT".to_string();
                                            } else {
                                                description =
                                                    "Thinking and planning next steps...".to_string();
                                                status = "PLANNING".to_string();
                                            }
                                        }
                                    }

                                    if description != last_action {
                                        last_action = description.clone();
                                        let event = json!({
                                            "type": "ai/status_update",
                                            "payload": {
                                                "runId": "live-antigravity",
                                                "agentName": "Gemini 3.8 Flash",
                                                "status": status,
                                                "stepDescription": description,
                                                "currentStep": step_idx
                                            }
                                        });
                                        let _ = tx.send(event.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}
