use tauri::{command, AppHandle};
use std::process::Command as StdCommand;

#[command]
pub async fn quit_app(app_handle: AppHandle) -> Result<(), String> {
    // Try to kill any process listening on port 1420 (Vite dev server)
    // This prevents "port already in use" when restarting in dev mode.
    let _ = kill_process_on_port(1420);

    // Exit the entire application (kills all windows, tray, backend processes)
    app_handle.exit(0);
    Ok(())
}

/// Kill any process listening on the given TCP port.
/// Uses `lsof` + `kill` on Linux, falls back to `fuser`.
fn kill_process_on_port(port: u16) -> Result<(), String> {
    // Try `fuser` first (available on most Linux systems, no sudo needed for own processes)
    let fuser_result = StdCommand::new("fuser")
        .args(["-k", &format!("{}/tcp", port)])
        .output();

    if let Ok(output) = fuser_result {
        if output.status.success() {
            return Ok(());
        }
    }

    // Fallback: use `lsof` to find PIDs, then `kill`
    let lsof_output = StdCommand::new("lsof")
        .args(["-ti", &format!(":{}", port)])
        .output()
        .map_err(|e| format!("lsof failed: {}", e))?;

    if !lsof_output.status.success() {
        // No process found on port 1420, that's fine
        return Ok(());
    }

    let pid_str = String::from_utf8_lossy(&lsof_output.stdout);
    for line in pid_str.lines() {
        let pid: u32 = line.trim().parse().unwrap_or(0);
        if pid > 0 {
            let _ = StdCommand::new("kill").args(["-9", &pid.to_string()]).output();
        }
    }

    Ok(())
}