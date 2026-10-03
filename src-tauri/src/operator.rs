//! Gated operator input execution.
//!
//! v1: validation + audit only. Real OS input behind `OPERATOR_LIVE=1`
//! (enigo wiring point). Default `enabled=false` — proposals require
//! explicit Approve and never auto-execute.

use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorDecision {
    pub action_id: String,
    pub decision: String, // APPROVED | DENIED
}

const ALLOWED_TOOLS: &[&str] = &["mouse_move", "click", "type", "hotkey"];

pub fn validate_tool(tool: &str, args_json: &str) -> Result<(), String> {
    if !ALLOWED_TOOLS.contains(&tool) {
        return Err(format!("Unknown operator tool: {}", tool));
    }
    let args: serde_json::Value =
        serde_json::from_str(args_json).map_err(|e| format!("Invalid args JSON: {}", e))?;
    match tool {
        "mouse_move" | "click" => {
            let ok = args.get("x").and_then(|v| v.as_i64()).is_some()
                && args.get("y").and_then(|v| v.as_i64()).is_some();
            if !ok {
                return Err(format!("{} requires numeric x and y", tool));
            }
            Ok(())
        }
        "type" => {
            let ok = args
                .get("text")
                .and_then(|v| v.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false);
            if !ok {
                return Err("type requires non-empty text".to_string());
            }
            Ok(())
        }
        "hotkey" => {
            let ok = args
                .get("keys")
                .and_then(|v| v.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false);
            if !ok {
                return Err("hotkey requires keys string".to_string());
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

/// v1 execution is a guarded no-op that records intent.
/// Set `OPERATOR_LIVE=1` + wire `enigo` here for real input.
#[allow(dead_code)]
pub fn execute(tool: &str, args_json: &str) -> Result<String, String> {
    validate_tool(tool, args_json)?;
    if std::env::var("OPERATOR_LIVE").unwrap_or_default() != "1" {
        return Ok(format!("guarded:{} (set OPERATOR_LIVE=1 for real input)", tool));
    }
    // TODO(enigo): real mouse/keyboard actuation via enigo crate.
    Ok(format!("executed:{}", tool))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_tool() {
        assert!(validate_tool("rm_rf", "{}").is_err());
    }

    #[test]
    fn requires_coordinates_for_click() {
        assert!(validate_tool("click", r#"{"x":10,"y":20}"#).is_ok());
        assert!(validate_tool("click", r#"{"x":"a"}"#).is_err());
    }

    #[test]
    fn guarded_execution_does_not_touch_os_by_default() {
        let r = execute("hotkey", r#"{"keys":"ctrl+s"}"#).unwrap();
        assert!(r.starts_with("guarded:"));
    }
}
