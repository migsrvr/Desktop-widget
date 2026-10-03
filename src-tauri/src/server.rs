use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::{Html, IntoResponse, Json},
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
}

pub async fn start_server_with_channel(
    port: u16,
    tx: broadcast::Sender<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state = Arc::new(ServerState { tx });

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
