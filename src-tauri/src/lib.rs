mod commands;

use commands::read_data::{read_data_file, read_data_file_raw};
use commands::run_pipeline::run_pipeline;
use commands::quit_app::quit_app;
use commands::list_history::list_history_files;
use commands::clear_history::clear_history_files;
use commands::write_data::write_data_file;
use commands::settings::{save_settings, load_settings};
use commands::translate::baidu_translate;
use commands::window::hide_to_tray;
use tauri::Emitter;

use std::process::Command as StdCommand;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

/// Kill any process holding port 1420 (Vite dev server).
/// Uses lsof to find PIDs, then kills them.
fn kill_vite_server() {
    // Step 1: Find PIDs listening on port 1420
    let lsof_out = StdCommand::new("lsof")
        .args(["-ti", ":1420"])
        .output();

    if let Ok(output) = lsof_out {
        if output.status.success() {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.lines() {
                let pid = pid.trim();
                if !pid.is_empty() {
                    let _ = StdCommand::new("kill").args(["-9", pid]).output();
                }
            }
        }
    }

    // Step 2: Also kill any vite/node processes that might be orphaned
    let _ = StdCommand::new("pkill")
        .args(["-f", "vite"])
        .output();
    let _ = StdCommand::new("pkill")
        .args(["-f", "node.*1420"])
        .output();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 标志：true = 用户选择"退出"，跳过最小化逻辑
    static SHOULD_QUIT: AtomicBool = AtomicBool::new(false);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 创建托盘菜单项
            let show = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .separator()
                .item(&quit)
                .build()?;

            // 创建托盘图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            // 先释放端口，再设置退出标志，最后关闭窗口
                            kill_vite_server();
                            SHOULD_QUIT.store(true, Ordering::SeqCst);
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.close();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭窗口时：如果用户点了"退出"则真正关闭，否则最小化到托盘
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if SHOULD_QUIT.load(Ordering::SeqCst) {
                    // 真正退出——先释放端口再退出整个应用
                    kill_vite_server();
                    let app = window.app_handle();
                    app.exit(0);
                } else {
                    // 用户点了窗口 X 按钮——发送事件让前端弹确认对话框
                    let _ = window.emit("show-close-dialog", ());
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_data_file,
            read_data_file_raw,
            run_pipeline,
            list_history_files,
            clear_history_files,
            write_data_file,
            save_settings,
            load_settings,
            quit_app,
            baidu_translate,
            hide_to_tray,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
