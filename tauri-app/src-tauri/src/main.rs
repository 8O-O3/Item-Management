#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use project_manager::commands::{self, AppState};
use project_manager::db::sqlite::SqliteStorage;
use std::path::PathBuf;
use tauri::Manager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let app_dir = handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            let storage = SqliteStorage::new(app_dir.clone()).expect("Failed to open database");
            handle.manage(AppState {
                storage: Box::new(storage),
                app_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_folders,
            commands::create_folder,
            commands::update_folder,
            commands::move_folder,
            commands::delete_folder,
            commands::get_projects,
            commands::create_project,
            commands::update_project,
            commands::move_project,
            commands::delete_project,
            commands::get_nodes,
            commands::create_node,
            commands::update_node,
            commands::delete_node,
            commands::add_file_to_node,
            commands::remove_file_from_node,
            commands::read_file_bytes,
            commands::add_timeline_entry,
            commands::update_timeline_entry,
            commands::delete_timeline_entry,
            commands::export_data,
            commands::import_data,
            commands::save_export,
            commands::save_node_file,
            commands::extract_docx_text,
            commands::open_app_dir,
            commands::get_api_configs,
            commands::create_api_config,
            commands::update_api_config,
            commands::delete_api_config,
            commands::call_ai_api,
            commands::call_ai_stream,
            commands::cancel_ai_stream,
            commands::search_all,
            commands::get_version,
            commands::create_chat_session,
            commands::get_chat_sessions,
            commands::update_chat_session,
            commands::delete_chat_session,
            commands::add_chat_message,
            commands::get_chat_messages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
