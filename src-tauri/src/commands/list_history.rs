use std::path::PathBuf;
use std::fs;
use tauri::command;
use serde::{Deserialize, Serialize};
use serde_json;

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub date: String,
    pub time: String,
    pub label: String,
}

#[command]
pub fn list_history_files(mode: String) -> Result<Vec<HistoryEntry>, String> {
    let data_dir = get_data_dir();
    let filename = match mode.as_str() {
        "paper" => "paper_history.json",
        "industry" => "industry_history.json",
        _ => return Err(format!("Unknown mode: {}", mode)),
    };
    let path = data_dir.join(filename);

    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read history file: {}", e))?;

    if content.trim().is_empty() {
        return Ok(vec![]);
    }

    let history: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse history JSON: {}", e))?;

    let mut entries = Vec::new();

    if let Some(obj) = history.as_object() {
        let mut dates: Vec<&String> = obj.keys().collect();
        dates.sort_by(|a, b| b.cmp(a)); // reverse chronological

        for date_key in dates {
            if let Some(timestamps) = obj[date_key].as_object() {
                let mut times: Vec<&String> = timestamps.keys().collect();
                times.sort_by(|a, b| b.cmp(a)); // reverse chronological

                for ts in times {
                    entries.push(HistoryEntry {
                        date: date_key.clone(),
                        time: ts.clone(),
                        label: format!("{}  {}", date_key, ts),
                    });
                }
            }
        }
    }

    Ok(entries)
}

fn get_data_dir() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap_or_default();
    if dir.ends_with("src-tauri") {
        dir.pop();
    }
    dir.join("data")
}