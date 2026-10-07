use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskRecord {
    pub id: String,
    pub day_plan_date: String,
    pub title: String,
    pub status: String,
    pub display_order: i32,
    pub estimated_minutes: Option<i32>,
    pub elapsed_focus_seconds: i32,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiRunRecord {
    pub id: String,
    pub task_id: Option<String>,
    pub agent_name: String,
    pub status: String,
    pub current_step_description: Option<String>,
    pub current_step: Option<i32>,
    pub total_steps: Option<i32>,
    pub files_modified_count: i32,
    pub test_status: String,
    pub summary: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEventRecord {
    pub id: String,
    pub day_plan_date: String,
    pub task_id: Option<String>,
    pub ai_run_id: Option<String>,
    pub event_type: String,
    pub summary: String,
    pub metadata_json: Option<String>,
    pub timestamp: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpotifyAuthRecord {
    pub client_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
    /// Spotify account product: "premium" | "free" | "open" | "" (unknown).
    pub account_type: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenSessionRecord {
    pub id: String,
    pub mode: String,
    pub consent_granted: i32,
    pub started_at: String,
    pub ended_at: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OperatorActionRecord {
    pub id: String,
    pub inference_id: Option<String>,
    pub task_id: Option<String>,
    pub tool_name: String,
    pub args_json: String,
    pub status: String,
    pub created_at: String,
    pub executed_at: Option<String>,
}

pub struct Database {
    db_path: PathBuf,
}

impl Database {
    pub fn init() -> Result<Self> {
        let app_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("WorkPulse");

        fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("workpulse.db");

        let conn = Connection::open(&db_path)?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS day_plans (
                date TEXT PRIMARY KEY,
                total_focus_seconds INTEGER DEFAULT 0,
                suggested_first_task TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                day_plan_date TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                estimated_minutes INTEGER,
                elapsed_focus_seconds INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS ai_runs (
                id TEXT PRIMARY KEY,
                task_id TEXT,
                agent_name TEXT NOT NULL,
                status TEXT NOT NULL,
                current_step_description TEXT,
                current_step INTEGER,
                total_steps INTEGER,
                files_modified_count INTEGER DEFAULT 0,
                test_status TEXT DEFAULT 'NOT_RUN',
                summary TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS timeline_events (
                id TEXT PRIMARY KEY,
                day_plan_date TEXT NOT NULL,
                task_id TEXT,
                ai_run_id TEXT,
                event_type TEXT NOT NULL,
                summary TEXT NOT NULL,
                metadata_json TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS spotify_auth (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                client_id TEXT NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                account_type TEXT NOT NULL DEFAULT '',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS screen_sessions (
                id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                consent_granted INTEGER NOT NULL DEFAULT 1,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ended_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS screen_frames (
                id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES screen_sessions(id) ON DELETE CASCADE,
                window_title TEXT,
                app_name TEXT,
                width INTEGER,
                height INTEGER,
                hash TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS vision_inferences (
                id TEXT PRIMARY KEY,
                frame_id TEXT REFERENCES screen_frames(id) ON DELETE CASCADE,
                provider TEXT NOT NULL,
                inferred_state TEXT NOT NULL,
                confidence REAL NOT NULL,
                summary TEXT,
                raw_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS operator_actions (
                id TEXT PRIMARY KEY,
                inference_id TEXT REFERENCES vision_inferences(id) ON DELETE SET NULL,
                task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                tool_name TEXT NOT NULL,
                args_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                executed_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS ai_provider_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                provider TEXT NOT NULL,
                api_key_ref TEXT NOT NULL,
                model TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )?;

        // Migration for databases created before account_type existed.
        // ALTER fails with "duplicate column name" when already applied — safe to ignore.
        let _ = conn.execute(
            "ALTER TABLE spotify_auth ADD COLUMN account_type TEXT NOT NULL DEFAULT ''",
            [],
        );

        Ok(Database { db_path })
    }

    pub fn get_conn(&self) -> Result<Connection> {
        Connection::open(&self.db_path)
    }

    pub fn list_tasks(&self, date: &str) -> Result<Vec<TaskRecord>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, day_plan_date, title, status, display_order, estimated_minutes, elapsed_focus_seconds, created_at, completed_at
             FROM tasks WHERE day_plan_date = ?1 ORDER BY display_order ASC",
        )?;

        let rows = stmt.query_map(params![date], |row| {
            Ok(TaskRecord {
                id: row.get(0)?,
                day_plan_date: row.get(1)?,
                title: row.get(2)?,
                status: row.get(3)?,
                display_order: row.get(4)?,
                estimated_minutes: row.get(5)?,
                elapsed_focus_seconds: row.get(6)?,
                created_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })?;

        let mut tasks = Vec::new();
        for task in rows {
            tasks.push(task?);
        }
        Ok(tasks)
    }

    pub fn list_all_tasks(&self) -> Result<Vec<TaskRecord>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, day_plan_date, title, status, display_order, estimated_minutes, elapsed_focus_seconds, created_at, completed_at
             FROM tasks ORDER BY display_order ASC, created_at ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(TaskRecord {
                id: row.get(0)?,
                day_plan_date: row.get(1)?,
                title: row.get(2)?,
                status: row.get(3)?,
                display_order: row.get(4)?,
                estimated_minutes: row.get(5)?,
                elapsed_focus_seconds: row.get(6)?,
                created_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })?;

        let mut tasks = Vec::new();
        for task in rows {
            tasks.push(task?);
        }
        Ok(tasks)
    }

    pub fn upsert_task(&self, task: &TaskRecord) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO tasks (id, day_plan_date, title, status, display_order, estimated_minutes, elapsed_focus_seconds, created_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                status = excluded.status,
                display_order = excluded.display_order,
                estimated_minutes = excluded.estimated_minutes,
                elapsed_focus_seconds = excluded.elapsed_focus_seconds,
                completed_at = excluded.completed_at",
            params![
                task.id,
                task.day_plan_date,
                task.title,
                task.status,
                task.display_order,
                task.estimated_minutes,
                task.elapsed_focus_seconds,
                task.created_at,
                task.completed_at
            ],
        )?;
        Ok(())
    }

    pub fn delete_task(&self, task_id: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])?;
        Ok(())
    }

    pub fn insert_timeline_event(&self, event: &TimelineEventRecord) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO timeline_events (id, day_plan_date, task_id, ai_run_id, event_type, summary, metadata_json, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                event.id,
                event.day_plan_date,
                event.task_id,
                event.ai_run_id,
                event.event_type,
                event.summary,
                event.metadata_json,
                event.timestamp
            ],
        )?;
        Ok(())
    }

    pub fn list_timeline_events(&self, date: &str) -> Result<Vec<TimelineEventRecord>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, day_plan_date, task_id, ai_run_id, event_type, summary, metadata_json, timestamp
             FROM timeline_events WHERE day_plan_date = ?1 ORDER BY timestamp DESC LIMIT 50",
        )?;

        let rows = stmt.query_map(params![date], |row| {
            Ok(TimelineEventRecord {
                id: row.get(0)?,
                day_plan_date: row.get(1)?,
                task_id: row.get(2)?,
                ai_run_id: row.get(3)?,
                event_type: row.get(4)?,
                summary: row.get(5)?,
                metadata_json: row.get(6)?,
                timestamp: row.get(7)?,
            })
        })?;

        let mut events = Vec::new();
        for evt in rows {
            events.push(evt?);
        }
        Ok(events)
    }

    #[allow(dead_code)]
    pub fn save_spotify_auth(&self, auth: &SpotifyAuthRecord) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO spotify_auth (id, client_id, access_token, refresh_token, expires_at, account_type, updated_at)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                 client_id = excluded.client_id,
                 access_token = excluded.access_token,
                 refresh_token = excluded.refresh_token,
                 expires_at = excluded.expires_at,
                 account_type = excluded.account_type,
                 updated_at = CURRENT_TIMESTAMP",
            params![auth.client_id, auth.access_token, auth.refresh_token, auth.expires_at, auth.account_type],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_spotify_auth(&self) -> Result<Option<SpotifyAuthRecord>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            "SELECT client_id, access_token, refresh_token, expires_at, account_type FROM spotify_auth WHERE id = 1",
        )?;

        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SpotifyAuthRecord {
                client_id: row.get(0)?,
                access_token: row.get(1)?,
                refresh_token: row.get(2)?,
                expires_at: row.get(3)?,
                account_type: row.get(4).unwrap_or_default(),
            }))
        } else {
            Ok(None)
        }
    }

    #[allow(dead_code)]
    pub fn delete_spotify_auth(&self) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute("DELETE FROM spotify_auth WHERE id = 1", [])?;
        Ok(())
    }

    // ---- Screen operator persistence (audit trail, no pixels stored) ----

    #[allow(dead_code)]
    pub fn create_screen_session(&self, id: &str, mode: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO screen_sessions (id, mode, consent_granted) VALUES (?1, ?2, 1)
             ON CONFLICT(id) DO NOTHING",
            params![id, mode],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn end_screen_session(&self, id: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE screen_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn insert_frame(
        &self,
        id: &str,
        session_id: &str,
        window_title: Option<&str>,
        app_name: Option<&str>,
        width: i64,
        height: i64,
        hash: &str,
    ) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO screen_frames (id, session_id, window_title, app_name, width, height, hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(id) DO NOTHING",
            params![id, session_id, window_title, app_name, width, height, hash],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn insert_inference(
        &self,
        id: &str,
        frame_id: &str,
        provider: &str,
        state: &str,
        confidence: f64,
        summary: Option<&str>,
        raw_json: Option<&str>,
    ) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO vision_inferences (id, frame_id, provider, inferred_state, confidence, summary, raw_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(id) DO NOTHING",
            params![id, frame_id, provider, state, confidence, summary, raw_json],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn propose_action(
        &self,
        id: &str,
        inference_id: Option<&str>,
        task_id: Option<&str>,
        tool_name: &str,
        args_json: &str,
    ) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO operator_actions (id, inference_id, task_id, tool_name, args_json, status)
             VALUES (?1, ?2, ?3, ?4, ?5, 'PROPOSED') ON CONFLICT(id) DO NOTHING",
            params![id, inference_id, task_id, tool_name, args_json],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn decide_action(&self, id: &str, decision: &str, executed: bool) -> Result<()> {
        let conn = self.get_conn()?;
        // Guard the PROPOSED -> APPROVED|DENIED -> EXECUTED|FAILED state machine.
        let status = if decision == "APPROVED" {
            if executed {
                "EXECUTED"
            } else {
                "APPROVED"
            }
        } else if decision == "DENIED" {
            "DENIED"
        } else {
            decision
        };
        let changed = conn.execute(
            "UPDATE operator_actions SET status = ?1,
             executed_at = CASE WHEN ?1 IN ('EXECUTED','FAILED') THEN CURRENT_TIMESTAMP ELSE executed_at END
             WHERE id = ?2 AND status = 'PROPOSED'",
            params![status, id],
        )?;
        // Allow APPROVED -> EXECUTED/FAILED transition as a second step.
        if changed == 0 && (status == "EXECUTED" || status == "FAILED") {
            conn.execute(
                "UPDATE operator_actions SET status = ?1, executed_at = CURRENT_TIMESTAMP
                 WHERE id = ?2 AND status = 'APPROVED'",
                params![status, id],
            )?;
        }
        Ok(())
    }
}
