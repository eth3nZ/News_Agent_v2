mod commands;

use commands::read_data::{read_data_file, read_data_file_raw};
use commands::run_pipeline::run_pipeline;
use commands::list_history::list_history_files;
use commands::clear_history::clear_history_files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_data_file,
            read_data_file_raw,
            run_pipeline,
            list_history_files,
            clear_history_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}