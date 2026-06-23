use crate::error::AppError;
use std::io::{BufRead, BufReader, Read};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

static STREAM_CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn cancel_stream() {
    STREAM_CANCELLED.store(true, Ordering::SeqCst);
}

// ── Function Calling (reserved) ──────────────────────────────
// When ready, add `tools: crate::tools::to_openai_tools()` to the
// request body.  If the AI returns `finish_reason: "tool_calls"`,
// call `crate::tools::execute_tool()` for each tool, feed results
// back as `role: "tool"` messages, and continue the conversation.

/// Call an OpenAI-compatible chat completions API (non-streaming).
pub fn call_ai_api(
    api_key: &str,
    base_url: &str,
    model: &str,
    messages_json: &str,
) -> Result<String, AppError> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let messages: serde_json::Value = serde_json::from_str(messages_json)?;

    let resp = ureq::post(&url)
        .set("Content-Type", "application/json")
        .set("Authorization", &format!("Bearer {}", api_key))
        .send_json(serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": 0.7
        }))?;

    let json: serde_json::Value = resp.into_json()?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::Other("Unexpected API response format - check your base_url and model name".into()))?;
    Ok(content.to_string())
}

/// Call an OpenAI-compatible API with SSE streaming.
/// Parses `data:` chunks and emits `ai-chunk` / `ai-done` events to the frontend.
pub fn call_ai_stream(
    api_key: &str,
    base_url: &str,
    model: &str,
    messages_json: &str,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let messages: serde_json::Value = serde_json::from_str(messages_json)?;

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "stream": true
    });

    let resp = ureq::post(&url)
        .set("Content-Type", "application/json")
        .set("Authorization", &format!("Bearer {}", api_key))
        .send_string(&body.to_string())?;

    // Check for non-stream response (some providers return a regular JSON error)
    let content_type = resp.header("content-type").unwrap_or("");
    if !content_type.contains("text/event-stream") {
        // Provider may not support streaming — try non-streaming fallback
        let json: serde_json::Value = resp.into_json()?;
        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let _ = app_handle.emit("ai-chunk", AiChunk { content });
        let _ = app_handle.emit("ai-done", AiDone { error: None });
        return Ok(());
    }

    STREAM_CANCELLED.store(false, Ordering::SeqCst);

    let reader = BufReader::new(resp.into_reader());

    std::thread::spawn(move || {
        let mut line = String::new();
        let mut reader = reader; // move into thread

        loop {
            if STREAM_CANCELLED.load(Ordering::SeqCst) {
                let _ = app_handle.emit("ai-done", AiDone { error: Some("cancelled".into()) });
                return;
            }
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => break, // EOF
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if trimmed == "data: [DONE]" {
                        break;
                    }
                    if let Some(data) = trimmed.strip_prefix("data: ") {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                            if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                                if !content.is_empty() {
                                    let _ = app_handle.emit("ai-chunk", AiChunk {
                                        content: content.to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit("ai-done", AiDone { error: None });
    });

    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct AiChunk {
    content: String,
}

#[derive(Clone, serde::Serialize)]
struct AiDone {
    error: Option<String>,
}

/// Extract plain text from a .docx file (base64-encoded data URL).
pub fn extract_docx_text(data: &str) -> Result<String, AppError> {
    let base64_str = if let Some(idx) = data.find(";base64,") {
        &data[idx + 8..]
    } else {
        data
    };

    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, base64_str)?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)?;
    let mut doc = archive.by_name("word/document.xml")?;
    let mut xml = String::new();
    doc.read_to_string(&mut xml)?;

    let mut result = String::new();
    for part in xml.split("<w:t") {
        if let Some(rest) = part.split_once('>') {
            if let Some((content, _)) = rest.1.split_once("</w:t>") {
                result.push_str(content);
            }
        }
    }

    if result.is_empty() {
        return Err(AppError::Other("No text content found in document".into()));
    }
    Ok(result)
}
