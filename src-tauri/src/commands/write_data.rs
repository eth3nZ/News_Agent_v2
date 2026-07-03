use std::path::PathBuf;
use std::fs;
use tauri::command;

#[command]
pub fn write_data_file(mode: String, content: String) -> Result<(), String> {
    let data_dir = get_data_dir();
    let filename = match mode.as_str() {
        "paper" => "paper_data.json",
        "industry" => "news_data.json",
        _ => return Err(format!("Unknown mode: {}", mode)),
    };
    let path = data_dir.join(filename);

    fs::write(&path, &content)
        .map_err(|e| format!("Failed to write data file: {}", e))
}

fn get_data_dir() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap_or_default();
    if dir.ends_with("src-tauri") {
        dir.pop();
    }
    dir.join("data")
}