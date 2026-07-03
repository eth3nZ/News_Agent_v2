use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::command;

/// Settings stored as a simple JSON file in the project data directory.
const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "model")]
    pub model: String,
    /// Auto-sync minute of day. 0 means manual sync only (no auto-sync).
    /// Positive values enable automatic pipeline sync at a fixed local clock time.
    #[serde(rename = "syncTime", default = "default_sync_time")]
    pub sync_time: u32,
    /// Baidu Translate API app ID (optional, for Chinese translation).
    #[serde(rename = "baiduAppId", default)]
    pub baidu_app_id: String,
    /// Baidu Translate API secret key (optional, for Chinese translation).
    #[serde(rename = "baiduSecretKey", default)]
    pub baidu_secret_key: String,
}

fn default_sync_time() -> u32 {
    0
}

fn get_settings_path() -> PathBuf {
    // Place settings in the project root's data/ directory
    let mut dir = std::env::current_dir().unwrap_or_default();
    if dir.ends_with("src-tauri") {
        dir.pop();
    }
    dir.join("data").join(SETTINGS_FILE)
}

#[command]
pub async fn save_settings(
    api_key: String,
    base_url: String,
    model: String,
    sync_time: u32,
    baidu_app_id: String,
    baidu_secret_key: String,
) -> Result<(), String> {
    let path = get_settings_path();
    let settings = AppSettings {
        api_key,
        base_url,
        model,
        sync_time,
        baidu_app_id,
        baidu_secret_key,
    };

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}

#[command]
pub async fn load_settings() -> Result<AppSettings, String> {
    let path = get_settings_path();

    if !path.exists() {
        // Return empty defaults
        return Ok(AppSettings {
            api_key: String::new(),
            base_url: "https://api.ds.com".to_string(),
            model: "ds-v4-flash".to_string(),
            sync_time: 0,
            baidu_app_id: String::new(),
            baidu_secret_key: String::new(),
        });
    }

    let json: String = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    let settings: AppSettings = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse settings file: {}", e))?;

    Ok(settings)
}