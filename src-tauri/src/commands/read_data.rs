use std::path::PathBuf;
use std::fs;
use tauri::command;

#[command]
pub fn read_data_file(mode: String) -> Result<String, String> {
    let data_dir = get_data_dir();
    let filename = match mode.as_str() {
        "paper" => "paper_data.json",
        "industry" => "news_data.json",
        _ => return Err(format!("Unknown mode: {}", mode)),
    };
    let path = data_dir.join(filename);

    if !path.exists() {
        return Err(format!("No data found for mode '{}'. Run sync first.", mode));
    }

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read data file: {}", e))
}

#[command]
pub fn read_data_file_raw(path: String) -> Result<String, String> {
    let data_dir = get_data_dir();
    let full_path = data_dir.join(&path);

    // Security: ensure the path is within the data directory
    if !full_path.starts_with(&data_dir) {
        return Err("Invalid path".to_string());
    }

    if !full_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

fn get_data_dir() -> PathBuf {
    // In development, use the project root's data/ directory
    let mut dir = std::env::current_dir().unwrap_or_default();
    // If running from src-tauri, go up one level
    if dir.ends_with("src-tauri") {
        dir.pop();
    }
    dir.join("data")
}