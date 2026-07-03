use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::{command, AppHandle, Emitter};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::time::sleep;

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

#[command]
pub async fn run_pipeline(
    app_handle: AppHandle,
    mode: String,
    lang: String,
    api_key: String,
    base_url: String,
    model: String,
) -> Result<PipelineResult, String> {
    let project_root = get_project_root();
    let pipeline_dir = project_root.join("pipeline");
    let main_script = pipeline_dir.join("main.py");

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

    let stdout = child.stdout.take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child.stderr.take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    let mode_clone = mode.clone();
    let app_handle_clone = app_handle.clone();

    // Read stdout line by line and emit events
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut collected = String::new();

        while let Ok(Some(line)) = lines.next_line().await {
            collected.push_str(&line);
            collected.push('\n');

            // Determine phase from the line content
            let phase = detect_phase(&line);

            // Emit progress event to frontend
            let _ = app_handle_clone.emit("pipeline-progress", PipelineProgress {
                mode: mode_clone.clone(),
                line: line.clone(),
                phase,
            });
        }

        collected
    });

    // Read stderr (only collected, not streamed)
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

    // Wait for process with timeout
    let deadline = Instant::now() + Duration::from_secs(PIPELINE_TIMEOUT_SECONDS);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = app_handle.emit("pipeline-progress", PipelineProgress {
                        mode: mode.clone(),
                        line: format!("❌ Pipeline timed out after {} seconds", PIPELINE_TIMEOUT_SECONDS),
                        phase: 0,
                    });
                    // Await handles to collect partial output
                    let (partial_stdout, partial_stderr) = tokio::join!(stdout_handle, stderr_handle);
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

    // Collect remaining output
    let (full_stdout, full_stderr) = tokio::join!(stdout_handle, stderr_handle);
    let stdout = full_stdout.unwrap_or_default();
    let stderr = full_stderr.unwrap_or_default();

    if status.success() {
        // Emit completion
        let _ = app_handle.emit("pipeline-progress", PipelineProgress {
            mode: mode.clone(),
            line: format!("✅ Pipeline completed for mode '{}' with lang '{}'", mode, lang),
            phase: 3, // final phase
        });

        Ok(PipelineResult {
            success: true,
            message: format!("Pipeline completed for mode '{}' with lang '{}'", mode, lang),
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
/// - "Scraping sources..." → phase 1
/// - "Running LLM pipeline..." → phase 2
/// - "Archived to history" → phase 3
/// - Anything else → phase 0 (detail line, not a phase boundary)
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
        if std::process::Command::new(cmd).arg("--version").output().is_ok() {
            return cmd.to_string();
        }
    }
    "python3".to_string()
}