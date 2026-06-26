use std::fs;
use std::path::PathBuf;
use tauri::command;

#[command]
pub fn clear_history_files(mode: String) -> Result<(), String> {
    let data_dir = get_data_dir();
    let filename = match mode.as_str() {
        "paper" => "paper_history.json",
        "industry" => "industry_history.json",
        "paper_data" => "paper_data.json",
        "industry_data" => "news_data.json",  // news_data.json is the industry data file
        _ => return Err(format!("Unknown mode: {}", mode)),
    };
    let path = data_dir.join(filename);

    if !path.exists() {
        return Ok(());  // Nothing to clear
    }

    // Overwrite with empty history structure
    let empty: serde_json::Value = serde_json::json!({});
    let content = serde_json::to_string_pretty(&empty)
        .map_err(|e| format!("Failed to serialize empty history: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to clear history file: {}", e))?;

    Ok(())
}

fn get_data_dir() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap_or_default();
    if dir.ends_with("src-tauri") {
        dir.pop();
    }
    dir.join("data")
}