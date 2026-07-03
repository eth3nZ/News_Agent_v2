use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::time::sleep;

const PIPELINE_SERVER_URL: &str = "http://127.0.0.1:8080";
const PIPELINE_TIMEOUT_SECONDS: u64 = 300;

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
    let app_for_emit = app_handle.clone();

    // Emit progress: connecting to pipeline server
    let _ = app_for_emit.emit(
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

    let request = RunRequest {
        mode: mode.clone(),
        lang: lang.clone(),
        api_key: api_key.clone(),
        base_url: base_url.clone(),
        model: model.clone(),
    };

    // Emit phase 1: scraping (server-side handles this)
    let _ = app_for_emit.emit(
        "pipeline-progress",
        PipelineProgress {
            mode: mode_for_emit.clone(),
            line: "🔄 Syncing data from pipeline server...".into(),
            phase: 1,
        },
    );

    let http_result = run_pipeline_via_server(request).await;
    let http_result = match http_result {
        Ok(result) => result,
        Err(server_error) => {
            let _ = app_for_emit.emit(
                "pipeline-progress",
                PipelineProgress {
                    mode: mode_for_emit.clone(),
                    line: format!(
                        "⚠️ Pipeline server unavailable, running local Python pipeline instead. ({})",
                        server_error
                    ),
                    phase: 0,
                },
            );
            run_pipeline_locally(
                app_handle.clone(),
                mode.clone(),
                lang.clone(),
                api_key,
                base_url,
                model,
            )
            .await?
        }
    };

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

async fn run_pipeline_via_server(request: RunRequest) -> Result<PipelineResult, String> {
    let url = format!("{}/api/v1/pipeline/run", PIPELINE_SERVER_URL);

    tokio::task::spawn_blocking(move || {
        let resp = ureq::post(&url)
            .header("Content-Type", "application/json")
            .send_json(&request)
            .map_err(|e| match &e {
                ureq::Error::StatusCode(code) => {
                    format!("Pipeline server returned HTTP {}", code)
                }
                _ => format!(
                    "Cannot connect to pipeline server at {}: {}",
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
    .map_err(|e| format!("Task join error: {}", e))?
}

async fn run_pipeline_locally(
    app_handle: AppHandle,
    mode: String,
    lang: String,
    api_key: String,
    base_url: String,
    model: String,
) -> Result<PipelineResult, String> {
    let project_root = get_project_root();
    let main_script = project_root.join("pipeline").join("main.py");

    if !main_script.exists() {
        return Err(format!("Pipeline script not found at {:?}", main_script));
    }

    let python_cmd = find_python();

    let mut child = TokioCommand::new(&python_cmd)
        .arg(&main_script)
        .arg("--mode")
        .arg(&mode)
        .arg("--lang")
        .arg(&lang)
        .arg("--api-key")
        .arg(&api_key)
        .arg("--base-url")
        .arg(&base_url)
        .arg("--model")
        .arg(&model)
        .current_dir(&project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to execute pipeline: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    let mode_clone = mode.clone();
    let app_handle_clone = app_handle.clone();

    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut collected = String::new();

        while let Ok(Some(line)) = lines.next_line().await {
            collected.push_str(&line);
            collected.push('\n');

            let phase = detect_phase(&line);
            let _ = app_handle_clone.emit(
                "pipeline-progress",
                PipelineProgress {
                    mode: mode_clone.clone(),
                    line,
                    phase,
                },
            );
        }

        collected
    });

    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        let mut collected = String::new();

        while let Ok(Some(line)) = lines.next_line().await {
            collected.push_str(&line);
            collected.push('\n');
        }

        collected
    });

    let deadline = Instant::now() + Duration::from_secs(PIPELINE_TIMEOUT_SECONDS);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill().await;
                    let _ = app_handle.emit(
                        "pipeline-progress",
                        PipelineProgress {
                            mode: mode.clone(),
                            line: format!(
                                "❌ Pipeline timed out after {} seconds",
                                PIPELINE_TIMEOUT_SECONDS
                            ),
                            phase: 0,
                        },
                    );
                    let (partial_stdout, partial_stderr) =
                        tokio::join!(stdout_handle, stderr_handle);
                    return Ok(PipelineResult {
                        success: false,
                        message: format!(
                            "Pipeline timed out after {} seconds for mode '{}'",
                            PIPELINE_TIMEOUT_SECONDS, mode
                        ),
                        stdout: partial_stdout.unwrap_or_default(),
                        stderr: partial_stderr.unwrap_or_default(),
                    });
                }
                sleep(Duration::from_millis(200)).await;
            }
            Err(e) => return Err(format!("Failed while waiting for pipeline: {}", e)),
        }
    };

    let (full_stdout, full_stderr) = tokio::join!(stdout_handle, stderr_handle);
    let stdout = full_stdout.unwrap_or_default();
    let stderr = full_stderr.unwrap_or_default();

    if status.success() {
        Ok(PipelineResult {
            success: true,
            message: format!(
                "Pipeline completed for mode '{}' with lang '{}'",
                mode, lang
            ),
            stdout,
            stderr,
        })
    } else {
        Ok(PipelineResult {
            success: false,
            message: format!("Pipeline failed for mode '{}' with lang '{}'", mode, lang),
            stdout,
            stderr,
        })
    }
}

/// Detect the pipeline phase from a stdout line.
fn detect_phase(line: &str) -> u8 {
    let trimmed = line.trim();
    if trimmed.contains("Scraping sources") || trimmed.contains("scraping sources") {
        1
    } else if trimmed.contains("Running LLM pipeline") || trimmed.contains("running LLM pipeline") {
        2
    } else if trimmed.contains("Archived to history") || trimmed.contains("archived to history") {
        3
    } else {
        0
    }
}

fn get_project_root() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap_or_default();
    if dir.ends_with("src-tauri") {
        dir.pop();
    }
    dir
}

fn find_python() -> String {
    for cmd in &["python3", "python"] {
        if std::process::Command::new(cmd)
            .arg("--version")
            .output()
            .is_ok()
        {
            return cmd.to_string();
        }
    }
    "python3".to_string()
}
