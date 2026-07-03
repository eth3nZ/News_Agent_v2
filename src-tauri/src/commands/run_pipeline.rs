use tauri::{command, AppHandle, Emitter};
use serde::{Deserialize, Serialize};

const PIPELINE_SERVER_URL: &str = "http://127.0.0.1:8765";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelineProgress {
    pub mode: String,
    pub line: String,
    /// Phase number (1-based). 0 means this line is just a progress detail, not a phase transition.
    pub phase: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineResult {
    pub success: bool,
    pub message: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Serialize)]
struct RunRequest {
    mode: String,
    lang: String,
    api_key: String,
    base_url: String,
    model: String,
}

#[command]
pub async fn run_pipeline(
    app_handle: AppHandle,
    mode: String,
    lang: String,
    api_key: String,
    base_url: String,
    model: String,
) -> Result<PipelineResult, String> {
    let mode_for_emit = mode.clone();
    let lang_for_emit = lang.clone();
    let _app = app_handle.clone();

    // Emit progress: connecting to pipeline server
    let _ = _app.emit(
        "pipeline-progress",
        PipelineProgress {
            mode: mode.clone(),
            line: format!(
                "🔗 Connecting to pipeline server at {}...",
                PIPELINE_SERVER_URL
            ),
            phase: 0,
        },
    );

    let url = format!("{}/run", PIPELINE_SERVER_URL);

    let request = RunRequest {
        mode,
        lang,
        api_key,
        base_url,
        model,
    };

    // Emit phase 1: scraping (server-side handles this)
    let _ = _app.emit(
        "pipeline-progress",
        PipelineProgress {
            mode: mode_for_emit.clone(),
            line: "🔄 Syncing data from pipeline server...".into(),
            phase: 1,
        },
    );

    // Run blocking HTTP request on a thread pool
    let http_result = tokio::task::spawn_blocking(move || {
        let resp = ureq::post(&url)
            .header("Content-Type", "application/json")
            .send_json(&request)
            .map_err(|e| match &e {
                ureq::Error::StatusCode(code) => {
                    format!(
                        "Pipeline server returned HTTP {}. Make sure the pipeline server is running:\n   python pipeline/server.py",
                        code
                    )
                }
                _ => format!(
                    "Cannot connect to pipeline server at {}: {}\n\n💡 Make sure the pipeline server is running:\n   python pipeline/server.py",
                    PIPELINE_SERVER_URL, e
                ),
            })?;

        let status = resp.status();
        let mut body_reader = resp.into_body();
        let response_body = body_reader
            .read_to_string()
            .map_err(|e| format!("Failed to read response body: {}", e))?;

        #[derive(Deserialize)]
        struct ServerResponse {
            success: bool,
            message: String,
            #[serde(default)]
            stdout: String,
            #[serde(default)]
            stderr: String,
        }

        if status == 200 {
            let parsed: ServerResponse =
                serde_json::from_str(&response_body).unwrap_or(ServerResponse {
                    success: true,
                    message: response_body.clone(),
                    stdout: response_body.clone(),
                    stderr: String::new(),
                });
            Ok::<PipelineResult, String>(PipelineResult {
                success: parsed.success,
                message: parsed.message,
                stdout: parsed.stdout,
                stderr: parsed.stderr,
            })
        } else {
            Ok(PipelineResult {
                success: false,
                message: format!("Pipeline server error (status {})", status),
                stdout: String::new(),
                stderr: response_body,
            })
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    // Emit completion
    let _ = app_handle.emit(
        "pipeline-progress",
        PipelineProgress {
            mode: mode_for_emit.clone(),
            line: if http_result.success {
                format!(
                    "✅ Pipeline completed for mode '{}' with lang '{}'",
                    mode_for_emit, lang_for_emit
                )
            } else {
                format!(
                    "❌ Pipeline failed for mode '{}': {}",
                    mode_for_emit, http_result.message
                )
            },
            phase: if http_result.success { 3 } else { 0 },
        },
    );

    Ok(http_result)
}