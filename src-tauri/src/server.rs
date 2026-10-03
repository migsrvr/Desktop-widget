use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{header, StatusCode},
    response::{Html, IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

pub struct ServerState {
    pub tx: broadcast::Sender<String>,
    pub screen: std::sync::Arc<crate::screen::ScreenManager>,
}

pub async fn start_server_with_channel(
    port: u16,
    tx: broadcast::Sender<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    start_server_with_screen(port, tx, std::sync::Arc::new(crate::screen::ScreenManager::new())).await
}

pub async fn start_server_with_screen(
    port: u16,
    tx: broadcast::Sender<String>,
    screen: std::sync::Arc<crate::screen::ScreenManager>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state = Arc::new(ServerState { tx, screen });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/ws", get(ws_handler))
        .route("/api/ai/event", post(ai_event_handler))
        .route("/api/task", post(task_event_handler))
        .route("/api/spotify/callback", get(spotify_callback_handler))
        .route("/api/screen/status", get(screen_status_handler))
        .route("/api/screen/capture", post(screen_capture_handler))
        .route("/api/screen/latest", get(screen_latest_handler))
        .route("/api/operator/propose", post(operator_propose_handler))
        .route("/api/operator/approve", post(operator_approve_handler))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("[WorkPulse] Embedded telemetry server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[allow(dead_code)]
pub async fn start_server(port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (tx, _rx) = broadcast::channel::<String>(100);
    start_server_with_channel(port, tx).await
}

async fn health_handler() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "app": "WorkPulse",
        "version": "0.1.0",
        "ws_url": "ws://127.0.0.1:41789/ws",
        "endpoints": {
            "ai_event": "POST /api/ai/event",
            "task": "POST /api/task"
        }
    }))
}

async fn ai_event_handler(
    axum::extract::State(state): axum::extract::State<Arc<ServerState>>,
    axum::Json(payload): axum::Json<serde_json::Value>,
) -> impl IntoResponse {
    let text = payload.to_string();
    let _ = state.tx.send(text);
    Json(json!({ "status": "ok", "delivered": true }))
}

async fn task_event_handler(
    axum::extract::State(state): axum::extract::State<Arc<ServerState>>,
    axum::Json(payload): axum::Json<serde_json::Value>,
) -> impl IntoResponse {
    let text = payload.to_string();
    let _ = state.tx.send(text);
    Json(json!({ "status": "ok", "delivered": true }))
}

// ---- Screen + operator bridge (no pixels persisted) ----

async fn screen_status_handler(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    Json(json!(state.screen.status()))
}

#[derive(serde::Deserialize, Default)]
struct CaptureBody {
    #[serde(default)]
    window_title: Option<String>,
    #[serde(default)]
    app_name: Option<String>,
}

async fn screen_capture_handler(
    State(state): State<Arc<ServerState>>,
    axum::Json(body): axum::Json<CaptureBody>,
) -> impl IntoResponse {
    let (meta, _jpeg, deduplicated) = state
        .screen
        .capture_now(body.window_title.clone(), body.app_name.clone());

    if !deduplicated {
        if let Ok(db) = crate::db::Database::init() {
            if let Some(sess) = state.screen.session_id() {
                let _ = db.create_screen_session(&sess, "MONITOR");
                let _ = db.insert_frame(
                    &meta.frame_id,
                    &sess,
                    body.window_title.as_deref(),
                    body.app_name.as_deref(),
                    meta.width as i64,
                    meta.height as i64,
                    &meta.hash,
                );
            }
        }
        let event = json!({ "type": "screen/observed", "payload": {
            "frameId": meta.frame_id, "sessionId": meta.session_id,
            "windowTitle": body.window_title, "appName": body.app_name,
            "width": meta.width, "height": meta.height,
            "hash": meta.hash, "capturedAt": meta.captured_at,
        }});
        let _ = state.tx.send(event.to_string());
    }

    Json(json!({ "status": "ok", "deduplicated": deduplicated, "frame": meta }))
}

async fn screen_latest_handler(State(state): State<Arc<ServerState>>) -> Response {
    match state.screen.last_jpeg() {
        Some(bytes) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/jpeg")],
            bytes,
        )
            .into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({ "error": "no frame yet" }))).into_response(),
    }
}

#[derive(serde::Deserialize)]
struct ProposeBody {
    #[serde(default)]
    action_id: Option<String>,
    #[serde(default)]
    inference_id: Option<String>,
    #[serde(default)]
    task_id: Option<String>,
    tool: String,
    #[serde(default)]
    args: serde_json::Value,
    #[serde(default)]
    prompt: Option<String>,
}

async fn operator_propose_handler(
    State(state): State<Arc<ServerState>>,
    axum::Json(body): axum::Json<ProposeBody>,
) -> impl IntoResponse {
    let args_json = body.args.to_string();
    if let Err(e) = crate::operator::validate_tool(&body.tool, &args_json) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "status": "error", "error": e })),
        )
            .into_response();
    }
    let action_id = body.action_id.unwrap_or_else(|| format!("act-{}", chrono::Utc::now().timestamp_millis()));
    if let Ok(db) = crate::db::Database::init() {
        let _ = db.propose_action(
            &action_id,
            body.inference_id.as_deref(),
            body.task_id.as_deref(),
            &body.tool,
            &args_json,
        );
    }
    let event = json!({ "type": "agent/action_proposed", "payload": {
        "actionId": action_id, "inferenceId": body.inference_id,
        "taskId": body.task_id, "tool": body.tool, "args": body.args,
        "prompt": body.prompt.unwrap_or_else(|| format!("Approve {}?", body.tool)),
        "status": "PROPOSED",
        "createdAt": chrono::Utc::now().to_rfc3339(),
    }});
    let _ = state.tx.send(event.to_string());
    Json(json!({ "status": "ok", "actionId": action_id })).into_response()
}

#[derive(serde::Deserialize)]
struct ApproveBody {
    action_id: String,
    decision: String, // APPROVED | DENIED
}

async fn operator_approve_handler(
    State(state): State<Arc<ServerState>>,
    axum::Json(body): axum::Json<ApproveBody>,
) -> impl IntoResponse {
    let decision = body.decision.to_uppercase();
    if decision != "APPROVED" && decision != "DENIED" {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "status": "error", "error": "decision must be APPROVED or DENIED" })),
        )
            .into_response();
    }
    if let Ok(db) = crate::db::Database::init() {
        // Record approval first (PROPOSED -> APPROVED/DENIED), execution flips to EXECUTED after.
        let _ = db.decide_action(&body.action_id, &decision, false);
    }
    let event = json!({ "type": "agent/action_decided",
        "payload": { "actionId": body.action_id, "decision": decision } });
    let _ = state.tx.send(event.to_string());
    // Also fan out as generic ai event so the widget timeline picks it up.
    let audit = json!({ "type": decision == "APPROVED",
        "payload": {} });
    let _ = audit; // keep audit trail in operator_actions table (no extra broadcast needed)
    Json(json!({ "status": "ok", "decision": decision })).into_response()
}

#[derive(serde::Deserialize)]
pub struct SpotifyAuthQuery {
    pub code: Option<String>,
    pub error: Option<String>,
}

async fn spotify_callback_handler(
    State(state): State<Arc<ServerState>>,
    Query(query): Query<SpotifyAuthQuery>,
) -> impl IntoResponse {
    if let Some(error) = query.error {
        return Html(format!(
            "<html><body style='background:#121214;color:#ff6b6b;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center;padding:32px;background:rgba(255,255,255,0.06);border-radius:16px;border:1px solid rgba(255,255,255,0.1)'><h2>Spotify Authorization Failed</h2><p style='color:rgba(255,255,255,0.7)'>{}</p></div></body></html>",
            error
        ));
    }

    if let Some(code) = query.code {
        if let Some(pending) = crate::spotify::take_pending_auth() {
            match crate::spotify::exchange_code(&code, &pending.client_id, &pending.code_verifier).await {
                Ok(token_resp) => {
                    let now = chrono::Utc::now().timestamp();
                    let record = crate::db::SpotifyAuthRecord {
                        client_id: pending.client_id.clone(),
                        access_token: token_resp.access_token,
                        refresh_token: token_resp.refresh_token.unwrap_or_default(),
                        expires_at: now + token_resp.expires_in,
                    };

                    if let Ok(db) = crate::db::Database::init() {
                        let _ = db.save_spotify_auth(&record);
                    }

                    let notify = json!({
                        "type": "spotify/auth_success",
                        "payload": {
                            "isConnected": true,
                            "clientId": pending.client_id
                        }
                    });
                    let _ = state.tx.send(notify.to_string());

                    return Html("<html><body style='background:#121214;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center;padding:32px;background:rgba(255,255,255,0.06);border-radius:16px;border:1px solid rgba(255,255,255,0.1)'><h2>WorkPulse Connected to Spotify!</h2><p style='color:rgba(255,255,255,0.7)'>You can close this tab and return to WorkPulse.</p></div></body></html>".to_string());
                }
                Err(err) => {
                    return Html(format!(
                        "<html><body style='background:#121214;color:#ff6b6b;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center;padding:32px;background:rgba(255,255,255,0.06);border-radius:16px;border:1px solid rgba(255,255,255,0.1)'><h2>Token Exchange Failed</h2><p style='color:rgba(255,255,255,0.7)'>{}</p></div></body></html>",
                        err
                    ));
                }
            }
        }
    }

    Html("<html><body style='background:#121214;color:#ff6b6b;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center;padding:32px;background:rgba(255,255,255,0.06);border-radius:16px;border:1px solid rgba(255,255,255,0.1)'><h2>Missing Spotify Auth Session</h2><p style='color:rgba(255,255,255,0.7)'>Please restart authentication from WorkPulse.</p></div></body></html>".to_string())
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<ServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    // Spawn task to forward broadcast messages to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages from this client and broadcast to all others
    let tx = state.tx.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            let _ = tx.send(text);
        }
    });

    // If either finishes, abort the other
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}
