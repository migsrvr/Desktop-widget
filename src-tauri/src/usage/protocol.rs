use serde_json::{json, Value};
use std::{fmt, time::Duration};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader, Lines};

#[derive(Debug, Clone)]
pub struct RpcError {
    pub detail: &'static str,
    pub retry_after: Option<u64>,
    pub authentication: bool,
}
impl fmt::Display for RpcError {
    fn fmt(&self, out: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(out, "{}", self.detail)
    }
}

impl RpcError {
    pub fn transport() -> Self {
        Self {
            detail: "The Codex usage connection closed. Reconnect to try again.",
            retry_after: None,
            authentication: false,
        }
    }
    pub fn from_response(error: &Value) -> Self {
        let message = error["message"].as_str().unwrap_or("").to_ascii_lowercase();
        let authentication =
            message.contains("auth") || message.contains("sign in") || message.contains("login");
        let retry_after = error["data"]["retryAfterSeconds"].as_u64().or_else(|| {
            error["data"]["retryAfterMs"]
                .as_u64()
                .map(|ms| ms.div_ceil(1000))
        });
        let detail = if authentication {
            "Sign in to Codex with your ChatGPT account to read plan limits."
        } else if error["code"].as_i64() == Some(-32601) {
            "This Codex version does not support the usage protocol. Update Codex and reconnect."
        } else if error["code"].as_i64() == Some(429) || retry_after.is_some() {
            "Codex requested a pause. Usage will refresh after the retry delay."
        } else {
            "Codex could not return plan limits. Try refreshing or reconnecting."
        };
        Self {
            detail,
            retry_after,
            authentication,
        }
    }
}

pub struct RpcClient<R, W> {
    lines: Lines<BufReader<R>>,
    writer: W,
    next_id: u64,
}
impl<R: AsyncRead + Unpin, W: AsyncWrite + Unpin> RpcClient<R, W> {
    pub fn new(reader: R, writer: W) -> Self {
        Self {
            lines: BufReader::new(reader).lines(),
            writer,
            next_id: 1,
        }
    }
    pub async fn send(&mut self, message: &Value) -> Result<(), RpcError> {
        let mut bytes = serde_json::to_vec(message).map_err(|_| RpcError::transport())?;
        bytes.push(b'\n');
        self.writer
            .write_all(&bytes)
            .await
            .map_err(|_| RpcError::transport())?;
        self.writer.flush().await.map_err(|_| RpcError::transport())
    }
    pub async fn next_message(&mut self) -> Result<Value, RpcError> {
        let line = self
            .lines
            .next_line()
            .await
            .map_err(|_| RpcError::transport())?
            .ok_or_else(RpcError::transport)?;
        if line.len() > 1_048_576 {
            return Err(RpcError {
                detail: "Codex returned an unsupported usage response.",
                retry_after: None,
                authentication: false,
            });
        }
        serde_json::from_str(&line).map_err(|_| RpcError {
            detail: "Codex returned an incompatible usage response.",
            retry_after: None,
            authentication: false,
        })
    }
    pub async fn request(
        &mut self,
        method: &str,
        params: Value,
        on_event: &mut impl FnMut(Value),
    ) -> Result<Value, RpcError> {
        let id = self.next_id;
        self.next_id += 1;
        self.send(&json!({"id":id,"method":method,"params":params}))
            .await?;
        tokio::time::timeout(Duration::from_secs(15), async {
            loop {
                let message = self.next_message().await?;
                if message.get("id").and_then(Value::as_u64) == Some(id) && message.get("method").is_none() {
                    if let Some(error) = message.get("error") { return Err(RpcError::from_response(error)); }
                    return message.get("result").cloned().ok_or_else(RpcError::transport);
                }
                if message.get("method").is_some() {
                    if message.get("id").is_some() {
                        self.send(&json!({"id":message["id"],"error":{"code":-32601,"message":"Not supported by this read-only usage client"}})).await?;
                    } else { on_event(message); }
                }
            }
        }).await.map_err(|_| RpcError { detail: "Codex usage request timed out. Retrying with backoff.", retry_after: None, authentication: false })?
    }
}
