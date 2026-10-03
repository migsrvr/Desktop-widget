use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
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
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )?;

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
            "INSERT INTO spotify_auth (id, client_id, access_token, refresh_token, expires_at, updated_at)
             VALUES (1, ?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                 client_id = excluded.client_id,
                 access_token = excluded.access_token,
                 refresh_token = excluded.refresh_token,
                 expires_at = excluded.expires_at,
                 updated_at = CURRENT_TIMESTAMP",
            params![auth.client_id, auth.access_token, auth.refresh_token, auth.expires_at],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_spotify_auth(&self) -> Result<Option<SpotifyAuthRecord>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            "SELECT client_id, access_token, refresh_token, expires_at FROM spotify_auth WHERE id = 1",
        )?;

        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SpotifyAuthRecord {
                client_id: row.get(0)?,
                access_token: row.get(1)?,
                refresh_token: row.get(2)?,
                expires_at: row.get(3)?,
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
}
