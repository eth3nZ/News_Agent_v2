use std::path::PathBuf;
use std::process::Command as SyncCommand;
use tauri::command;
use serde::{Deserialize, Serialize};
use tokio::task::spawn_blocking;

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineResult {
    pub success: bool,
    pub message: String,
    pub stdout: String,
    pub stderr: String,
}

#[command]
pub async fn run_pipeline(mode: String, lang: String) -> Result<PipelineResult, String> {
    let project_root = get_project_root();
    let pipeline_dir = project_root.join("pipeline");
    let main_script = pipeline_dir.join("main.py");

    if !main_script.exists() {
        return Err(format!("Pipeline script not found at {:?}", main_script));
    }

    let python_cmd = find_python();

    // Run the blocking Python process on a separate thread so the UI stays responsive
    let inner: Result<PipelineResult, String> = spawn_blocking(move || -> Result<PipelineResult, String> {
        let mut cmd = SyncCommand::new(&python_cmd);
        cmd.arg(&main_script)
            .arg("--mode")
            .arg(&mode)
            .arg("--lang")
            .arg(&lang)
            .current_dir(&project_root);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to execute pipeline: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
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
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    inner
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
        if SyncCommand::new(cmd).arg("--version").output().is_ok() {
            return cmd.to_string();
        }
    }
    "python3".to_string()
}