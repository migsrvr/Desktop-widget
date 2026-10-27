//! Read-only Agent Manager telemetry. Database work stays off the Axum runtime.

use chrono::{SecondsFormat, Utc};
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::sync::broadcast;

const DEFAULT_GROUP: &str = "Work Window Haptics";
const POLL_INTERVAL: Duration = Duration::from_millis(1000);
const BUSY_TIMEOUT: Duration = Duration::from_millis(100);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FleetSession {
    id: String,
    name: String,
    tool: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_status_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FleetTelemetry {
    group_name: String,
    sessions: Vec<FleetSession>,
    last_updated: String,
}

fn configured_group(value: Option<String>) -> String {
    // An explicitly empty filter means all unarchived sessions.
    value.unwrap_or_else(|| DEFAULT_GROUP.to_string())
}

fn database_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(path) = std::env::var_os("AGENT_MANAGER_DB_PATH") {
        if !path.is_empty() {
            paths.push(PathBuf::from(path));
        }
    }
    #[cfg(target_os = "windows")]
    {
        paths.push(PathBuf::from(
            r"\\wsl.localhost\Ubuntu\home\miggy\.config\agent-manager\state.db",
        ));
        paths.push(PathBuf::from(
            r"\\wsl$\Ubuntu\home\miggy\.config\agent-manager\state.db",
        ));
    }
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".config").join("agent-manager").join("state.db"));
    }
    paths.dedup();
    paths
}

fn open_read_only(path: &Path) -> rusqlite::Result<Connection> {
    if !path.exists() {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
            Some(format!("database file does not exist: {}", path.display())),
        ));
    }

    // On Windows, SQLite cannot open or query WAL-mode databases directly over UNC network shares
    // (such as \\wsl.localhost\Ubuntu\...) because SQLite's Windows VFS fails file locking and
    // shared memory (-shm) allocation on network filesystems with "database is locked".
    // We snapshot the database files (state.db, state.db-wal, state.db-shm) to a local temp folder
    // and open the local copy read-only.
    let path_str = path.to_string_lossy();
    if path_str.starts_with(r"\\") {
        if let Some(parent) = path.parent() {
            let cache_dir = std::env::temp_dir().join("workpulse-fleet-cache");
            let _ = std::fs::create_dir_all(&cache_dir);
            for file_name in &["state.db", "state.db-wal", "state.db-shm"] {
                let src = parent.join(file_name);
                let dst = cache_dir.join(file_name);
                if src.exists() {
                    let _ = std::fs::copy(&src, &dst);
                } else if dst.exists() {
                    let _ = std::fs::remove_file(&dst);
                }
            }
            let local_db = cache_dir.join("state.db");
            let conn = Connection::open_with_flags(&local_db, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
            conn.busy_timeout(BUSY_TIMEOUT)?;
            return Ok(conn);
        }
    }

    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    connection.busy_timeout(BUSY_TIMEOUT)?;
    Ok(connection)
}

fn timestamp_millis(nanoseconds: Option<i64>) -> Option<i64> {
    // Agent Manager stores UnixNano; JS numbers cannot represent those exactly.
    nanoseconds.filter(|value| *value > 0).map(|value| value / 1_000_000)
}

fn read_sessions(connection: &Connection, group: &str) -> rusqlite::Result<Vec<FleetSession>> {
    let mut statement = connection.prepare(
        "SELECT id, name, tool, status, model, last_status_at
         FROM sessions
         WHERE archived = 0 AND (?1 = '' OR group_name = ?1)
         ORDER BY name COLLATE NOCASE, id",
    )?;
    let rows = statement.query_map([group], |row| {
        let model: Option<String> = row.get(4)?;
        let status: Option<String> = row.get(3)?;
        Ok(FleetSession {
            id: row.get(0)?,
            name: row.get(1)?,
            tool: row.get(2)?,
            status: status.filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "unknown".to_string()),
            model: model.filter(|value| !value.trim().is_empty()),
            last_status_at: timestamp_millis(row.get(5)?),
        })
    })?;
    rows.collect()
}

fn read_fleet(paths: &[PathBuf], group: &str) -> Result<Vec<FleetSession>, String> {
    let mut last_error = None;
    for path in paths {
        match open_read_only(path).and_then(|connection| read_sessions(&connection, group)) {
            Ok(sessions) => return Ok(sessions),
            Err(error) => last_error = Some(error.to_string()),
        }
    }
    Err(last_error.unwrap_or_else(|| "no Agent Manager database path available".to_string()))
}

fn status_event(group: &str, sessions: Vec<FleetSession>) -> String {
    let telemetry = FleetTelemetry {
        group_name: group.to_string(),
        sessions,
        last_updated: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
    };
    serde_json::json!({ "type": "fleet/status_update", "payload": telemetry }).to_string()
}

pub fn start_fleet_watcher(tx: broadcast::Sender<String>) {
    let group = configured_group(std::env::var("WORKPULSE_FLEET_GROUP").ok());
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(POLL_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut unavailable = false;
        loop {
            interval.tick().await;
            let poll_group = group.clone();
            // Reopen and rediscover each tick: handle startup ordering, file replacement,
            // temporary locks, and WSL paths becoming available after the app starts.
            let result = tokio::task::spawn_blocking(move || {
                read_fleet(&database_paths(), &poll_group)
            }).await;
            let result = match result {
                Ok(result) => result,
                Err(error) => Err(format!("fleet database task failed: {error}")),
            };
            match result {
                Ok(sessions) => {
                    if unavailable {
                        eprintln!("[WorkPulse] Agent Manager fleet telemetry available again");
                    }
                    unavailable = false;
                    // Heartbeat even without changes so reconnecting clients get a snapshot.
                    let _ = tx.send(status_event(&group, sessions));
                }
                Err(error) => {
                    if !unavailable {
                        eprintln!("[WorkPulse] Agent Manager fleet unavailable; retrying: {error}");
                    }
                    unavailable = true;
                    // No heartbeat on failure: clients expire the last successful snapshot.
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn fixture() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(
            "CREATE TABLE sessions (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, tool TEXT NOT NULL,
                group_name TEXT NOT NULL, status TEXT, archived INTEGER NOT NULL,
                model TEXT, last_status_at INTEGER
             );",
        ).unwrap();
        connection
    }

    fn insert(connection: &Connection, id: &str, group: &str, archived: i64,
              status: Option<&str>, model: Option<&str>) {
        connection.execute(
            "INSERT INTO sessions VALUES (?1, ?1, 'codex', ?2, ?3, ?4, ?5, ?6)",
            params![id, group, status, archived, model, 1_791_701_354_685_468_171_i64],
        ).unwrap();
    }

    fn temporary_path() -> PathBuf {
        static NEXT_ID: AtomicU64 = AtomicU64::new(0);
        std::env::temp_dir().join(format!(
            "workpulse-fleet-{}-{}-{}.db", std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap(), NEXT_ID.fetch_add(1, Ordering::Relaxed),
        ))
    }

    #[test]
    fn group_defaults_and_explicit_empty_are_distinct() {
        assert_eq!(configured_group(None), DEFAULT_GROUP);
        assert_eq!(configured_group(Some(String::new())), "");
        assert_eq!(configured_group(Some("Other".into())), "Other");
    }

    #[test]
    fn group_filter_is_exact_and_archived_sessions_are_omitted() {
        let connection = fixture();
        insert(&connection, "active", DEFAULT_GROUP, 0, Some("working"), None);
        insert(&connection, "archived", DEFAULT_GROUP, 1, Some("working"), None);
        insert(&connection, "also-archived", DEFAULT_GROUP, 2, Some("idle"), None);
        insert(&connection, "other", "Other", 0, Some("working"), None);
        insert(&connection, "partial", "Work Window Haptics Extra", 0, Some("idle"), None);
        let sessions = read_sessions(&connection, DEFAULT_GROUP).unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "active");
        assert_eq!(read_sessions(&connection, "").unwrap().len(), 3);
        assert!(read_sessions(&connection, "' OR 1=1 --").unwrap().is_empty());
    }

    #[test]
    fn statuses_and_nullable_models_are_preserved_without_guessing() {
        let connection = fixture();
        for (id, status, model) in [
            ("1", Some("working"), Some("gpt-6.1-sol")),
            ("2", Some("idle"), None),
            ("3", Some("dead"), Some("")),
            ("4", Some("waiting_input"), Some("  ")),
            ("5", Some("new_status"), None),
            ("6", None, None),
            ("7", Some(""), None),
        ] {
            insert(&connection, id, DEFAULT_GROUP, 0, status, model);
        }
        let sessions = read_sessions(&connection, DEFAULT_GROUP).unwrap();
        let statuses: Vec<_> = sessions.iter().map(|session| session.status.as_str()).collect();
        assert_eq!(statuses, ["working", "idle", "dead", "waiting_input", "new_status", "unknown", "unknown"]);
        assert_eq!(sessions[0].model.as_deref(), Some("gpt-6.1-sol"));
        assert!(sessions[1..].iter().all(|session| session.model.is_none()));
    }

    #[test]
    fn timestamp_conversion_uses_nanoseconds_and_handles_missing_values() {
        assert_eq!(timestamp_millis(Some(1_791_701_354_685_468_171)), Some(1_791_701_354_685));
        assert_eq!(timestamp_millis(None), None);
        assert_eq!(timestamp_millis(Some(0)), None);
        assert_eq!(timestamp_millis(Some(-1)), None);
        assert_eq!(timestamp_millis(Some(i64::MAX)), Some(9_223_372_036_854));
    }

    #[test]
    fn missing_database_is_not_created() {
        let path = temporary_path();
        assert!(open_read_only(&path).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn database_connection_cannot_write_and_can_retry_after_lock() {
        let path = temporary_path();
        {
            let writer = Connection::open(&path).unwrap();
            writer.execute_batch("CREATE TABLE probe (value INTEGER);").unwrap();
            let reader = open_read_only(&path).unwrap();
            assert!(reader.execute("INSERT INTO probe VALUES (1)", []).is_err());
            writer.execute_batch("BEGIN EXCLUSIVE;").unwrap();
            assert!(reader.query_row("SELECT COUNT(*) FROM probe", [], |row| row.get::<_, i64>(0)).is_err());
            writer.execute_batch("ROLLBACK;").unwrap();
            assert_eq!(reader.query_row("SELECT COUNT(*) FROM probe", [], |row| row.get::<_, i64>(0)).unwrap(), 0);
        }
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn discovery_retries_other_paths_and_reports_schema_errors() {
        let path = temporary_path();
        {
            let database = Connection::open(&path).unwrap();
            database.execute_batch(
                "CREATE TABLE sessions (id TEXT, name TEXT, tool TEXT, group_name TEXT,
                    status TEXT, archived INTEGER, model TEXT, last_status_at INTEGER);"
            ).unwrap();
        }
        assert!(read_fleet(&[temporary_path(), path.clone()], DEFAULT_GROUP).unwrap().is_empty());
        {
            let database = Connection::open(&path).unwrap();
            database.execute_batch("DROP TABLE sessions;").unwrap();
        }
        assert!(read_fleet(&[path.clone()], DEFAULT_GROUP).is_err());
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn event_matches_camel_case_contract_with_utc_heartbeat() {
        let connection = fixture();
        insert(&connection, "agent", DEFAULT_GROUP, 0, Some("working"), None);
        let value: serde_json::Value = serde_json::from_str(
            &status_event(DEFAULT_GROUP, read_sessions(&connection, DEFAULT_GROUP).unwrap())
        ).unwrap();
        assert_eq!(value["type"], "fleet/status_update");
        assert_eq!(value["payload"]["groupName"], DEFAULT_GROUP);
        assert_eq!(value["payload"]["sessions"][0], serde_json::json!({
            "id": "agent", "name": "agent", "tool": "codex", "status": "working",
            "lastStatusAt": 1_791_701_354_685_i64,
        }));
        let updated = value["payload"]["lastUpdated"].as_str().unwrap();
        assert!(updated.ends_with('Z'));
        assert!(chrono::DateTime::parse_from_rfc3339(updated).is_ok());
        let empty: serde_json::Value = serde_json::from_str(&status_event("", vec![])).unwrap();
        assert_eq!(empty["payload"]["groupName"], "");
        assert_eq!(empty["payload"]["sessions"], serde_json::json!([]));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_wsl_unc_path_readable() {
        let unc_path = PathBuf::from(r"\\wsl.localhost\Ubuntu\home\miggy\.config\agent-manager\state.db");
        if unc_path.exists() {
            let conn = open_read_only(&unc_path).unwrap();
            let sessions = read_sessions(&conn, DEFAULT_GROUP).unwrap();
            assert!(!sessions.is_empty());
        }
    }
}

