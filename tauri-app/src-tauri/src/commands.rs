use crate::error::AppError;
use crate::models::{Folder, Project, Node, NodeFile, TimelineEntry, ApiConfig, ChatSession, ChatMessage};
use crate::services;
use crate::storage::Storage;
use tauri::State;

pub struct AppState {
    pub storage: Box<dyn Storage>,
    pub app_dir: std::path::PathBuf,
}

// ── Folders ──────────────────────────────────────────────

#[tauri::command]
pub fn get_folders(state: State<AppState>) -> Result<Vec<Folder>, String> {
    state.storage.get_folders().map_err(String::from)
}

#[tauri::command]
pub fn create_folder(name: String, parent_id: Option<i64>, state: State<AppState>) -> Result<Folder, String> {
    state.storage.create_folder(&name, parent_id).map_err(String::from)
}

#[tauri::command]
pub fn update_folder(id: i64, name: String, state: State<AppState>) -> Result<(), String> {
    state.storage.update_folder(id, &name).map_err(String::from)
}

#[tauri::command]
pub fn move_folder(id: i64, new_parent_id: Option<i64>, state: State<AppState>) -> Result<(), String> {
    state.storage.move_folder(id, new_parent_id).map_err(String::from)
}

#[tauri::command]
pub fn delete_folder(id: i64, state: State<AppState>) -> Result<(), String> {
    state.storage.delete_folder(id).map_err(String::from)
}

// ── Projects ─────────────────────────────────────────────

#[tauri::command]
pub fn get_projects(state: State<AppState>) -> Result<Vec<Project>, String> {
    state.storage.get_projects().map_err(String::from)
}

#[tauri::command]
pub fn create_project(name: String, desc: Option<String>, folder_id: Option<i64>, state: State<AppState>) -> Result<Project, String> {
    state.storage.create_project(&name, desc.as_deref(), folder_id).map_err(String::from)
}

#[tauri::command]
pub fn update_project(id: i64, name: String, desc: Option<String>, folder_id: Option<i64>, state: State<AppState>) -> Result<(), String> {
    state.storage.update_project(id, &name, desc.as_deref(), folder_id).map_err(String::from)
}

#[tauri::command]
pub fn move_project(id: i64, new_folder_id: Option<i64>, state: State<AppState>) -> Result<(), String> {
    state.storage.move_project(id, new_folder_id).map_err(String::from)
}

#[tauri::command]
pub fn delete_project(id: i64, state: State<AppState>) -> Result<(), String> {
    state.storage.delete_project(id).map_err(String::from)
}

// ── Nodes ────────────────────────────────────────────────

#[tauri::command]
pub fn get_nodes(project_id: i64, state: State<AppState>) -> Result<Vec<Node>, String> {
    state.storage.get_nodes(project_id).map_err(String::from)
}

#[tauri::command]
pub fn create_node(project_id: i64, title: String, desc: Option<String>, state: State<AppState>) -> Result<Node, String> {
    state.storage.create_node(project_id, &title, desc.as_deref()).map_err(String::from)
}

#[tauri::command]
pub fn update_node(id: i64, title: String, desc: Option<String>, state: State<AppState>) -> Result<(), String> {
    state.storage.update_node(id, &title, desc.as_deref()).map_err(String::from)
}

#[tauri::command]
pub fn delete_node(id: i64, state: State<AppState>) -> Result<(), String> {
    state.storage.delete_node(id).map_err(String::from)
}

// ── Files ────────────────────────────────────────────────

#[tauri::command]
pub fn add_file_to_node(node_id: i64, name: String, path: String, size: Option<i64>, data: Option<String>, state: State<AppState>) -> Result<(), String> {
    let file = NodeFile { name, path, size, data, added_at: chrono::Local::now().to_rfc3339() };
    state.storage.add_file_to_node(node_id, file).map_err(String::from)
}

#[tauri::command]
pub fn remove_file_from_node(node_id: i64, file_idx: usize, state: State<AppState>) -> Result<(), String> {
    state.storage.remove_file_from_node(node_id, file_idx).map_err(String::from)
}

#[tauri::command]
pub fn read_file_bytes(node_id: i64, file_idx: usize, state: State<AppState>) -> Result<Vec<u8>, String> {
    state.storage.read_file_bytes(node_id, file_idx).map_err(String::from)
}

// ── Timeline ─────────────────────────────────────────────

#[tauri::command]
pub fn add_timeline_entry(node_id: i64, content: String, state: State<AppState>) -> Result<(), String> {
    let entry = TimelineEntry { content, time: chrono::Local::now().to_rfc3339() };
    state.storage.add_timeline_entry(node_id, entry).map_err(String::from)
}

#[tauri::command]
pub fn update_timeline_entry(node_id: i64, entry_idx: usize, content: String, state: State<AppState>) -> Result<(), String> {
    state.storage.update_timeline_entry(node_id, entry_idx, &content).map_err(String::from)
}

#[tauri::command]
pub fn delete_timeline_entry(node_id: i64, entry_idx: usize, state: State<AppState>) -> Result<(), String> {
    state.storage.delete_timeline_entry(node_id, entry_idx).map_err(String::from)
}

// ── Export / Import ──────────────────────────────────────

#[tauri::command]
pub fn export_data(state: State<AppState>) -> Result<String, String> {
    state.storage.export_all().map_err(String::from)
}

#[tauri::command]
pub fn import_data(json_data: String, state: State<AppState>) -> Result<(), String> {
    #[derive(serde::Deserialize)]
    struct ImportData {
        folders: Vec<Folder>,
        projects: Vec<Project>,
        nodes: Vec<Node>,
    }
    let data: ImportData = serde_json::from_str(&json_data).map_err(AppError::from).map_err(String::from)?;
    state.storage.import_all(data.folders, data.projects, data.nodes).map_err(String::from)
}

#[tauri::command]
pub fn save_export(path: String, state: State<AppState>) -> Result<(), String> {
    let json = state.storage.export_all().map_err(String::from)?;
    std::fs::write(&path, &json).map_err(AppError::from).map_err(String::from)?;
    Ok(())
}

// ── Filesystem ───────────────────────────────────────────

#[tauri::command]
pub fn save_node_file(data: String, path: String) -> Result<(), String> {
    let base64_str = if let Some(idx) = data.find(";base64,") {
        &data[idx + 8..]
    } else {
        &data
    };
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, base64_str)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn extract_docx_text(data: String) -> Result<String, String> {
    services::extract_docx_text(&data).map_err(String::from)
}

#[tauri::command]
pub fn open_app_dir(state: State<AppState>) -> Result<(), String> {
    let path = state.app_dir.to_string_lossy().to_string();
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Version ───────────────────────────────────────────────

#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── API Configs ───────────────────────────────────────────

#[tauri::command]
pub fn get_api_configs(state: State<AppState>) -> Result<Vec<ApiConfig>, String> {
    state.storage.get_api_configs().map_err(String::from)
}

#[tauri::command]
pub fn create_api_config(
    name: String,
    api_key: String,
    base_url: String,
    model: String,
    system_prompt: Option<String>,
    state: State<AppState>,
) -> Result<ApiConfig, String> {
    state.storage.create_api_config(&name, &api_key, &base_url, &model, system_prompt.as_deref().unwrap_or(""))
        .map_err(String::from)
}

#[tauri::command]
pub fn update_api_config(
    id: i64,
    name: String,
    api_key: String,
    base_url: String,
    model: String,
    system_prompt: Option<String>,
    state: State<AppState>,
) -> Result<(), String> {
    state.storage.update_api_config(id, &name, &api_key, &base_url, &model, system_prompt.as_deref().unwrap_or(""))
        .map_err(String::from)
}

#[tauri::command]
pub fn delete_api_config(id: i64, state: State<AppState>) -> Result<(), String> {
    state.storage.delete_api_config(id).map_err(String::from)
}

// ── AI ───────────────────────────────────────────────────

#[tauri::command]
pub fn call_ai_stream(
    api_key: String,
    base_url: String,
    model: String,
    messages_json: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    services::call_ai_stream(&api_key, &base_url, &model, &messages_json, app_handle)
        .map_err(String::from)
}

#[tauri::command]
pub fn cancel_ai_stream() {
    services::cancel_stream();
}

#[tauri::command]
pub fn call_ai_api(api_key: String, base_url: String, model: String, messages_json: String) -> Result<String, String> {
    services::call_ai_api(&api_key, &base_url, &model, &messages_json).map_err(String::from)
}

// ── Search ────────────────────────────────────────────────

#[tauri::command]
pub fn search_all(query: String, state: State<AppState>) -> Result<Vec<crate::models::SearchResult>, String> {
    state.storage.search_nodes(&query).map_err(String::from)
}

// ── Chat Sessions ──────────────────────────────────────────

#[tauri::command]
pub fn create_chat_session(title: String, model_config_id: Option<i64>, context_json: String, state: State<AppState>) -> Result<ChatSession, String> {
    state.storage.create_chat_session(&title, model_config_id, &context_json).map_err(String::from)
}

#[tauri::command]
pub fn get_chat_sessions(state: State<AppState>) -> Result<Vec<ChatSession>, String> {
    state.storage.get_chat_sessions().map_err(String::from)
}

#[tauri::command]
pub fn update_chat_session(id: i64, title: String, model_config_id: Option<i64>, context_json: String, state: State<AppState>) -> Result<(), String> {
    state.storage.update_chat_session(id, &title, model_config_id, &context_json).map_err(String::from)
}

#[tauri::command]
pub fn delete_chat_session(id: i64, state: State<AppState>) -> Result<(), String> {
    state.storage.delete_chat_session(id).map_err(String::from)
}

// ── Chat Messages ──────────────────────────────────────────

#[tauri::command]
pub fn add_chat_message(session_id: i64, role: String, content: String, state: State<AppState>) -> Result<ChatMessage, String> {
    state.storage.add_chat_message(session_id, &role, &content).map_err(String::from)
}

#[tauri::command]
pub fn get_chat_messages(session_id: i64, state: State<AppState>) -> Result<Vec<ChatMessage>, String> {
    state.storage.get_chat_messages(session_id).map_err(String::from)
}
