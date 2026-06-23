// ── Storage Trait — abstract over SQLite / PostgreSQL / etc. ──
//
// To swap backends, implement this trait and change one line in main.rs.
// All commands work through `Box<dyn Storage>`, never touching the concrete type.

use crate::error::AppError;
use crate::models::{Folder, Project, Node, NodeFile, TimelineEntry, ApiConfig, ChatSession, ChatMessage, SearchResult};

pub trait Storage: Send + Sync {
    // ── Folders ──────────────────────────────────────────
    fn create_folder(&self, name: &str, parent_id: Option<i64>) -> Result<Folder, AppError>;
    fn get_folders(&self) -> Result<Vec<Folder>, AppError>;
    fn update_folder(&self, id: i64, name: &str) -> Result<(), AppError>;
    fn move_folder(&self, id: i64, new_parent_id: Option<i64>) -> Result<(), AppError>;
    fn delete_folder(&self, id: i64) -> Result<(), AppError>;

    // ── Projects ─────────────────────────────────────────
    fn create_project(
        &self,
        name: &str,
        desc: Option<&str>,
        folder_id: Option<i64>,
    ) -> Result<Project, AppError>;
    fn get_projects(&self) -> Result<Vec<Project>, AppError>;
    fn update_project(&self, id: i64, name: &str, desc: Option<&str>, folder_id: Option<i64>) -> Result<(), AppError>;
    fn move_project(&self, id: i64, new_folder_id: Option<i64>) -> Result<(), AppError>;
    fn delete_project(&self, id: i64) -> Result<(), AppError>;

    // ── Nodes ────────────────────────────────────────────
    fn create_node(
        &self,
        project_id: i64,
        title: &str,
        desc: Option<&str>,
    ) -> Result<Node, AppError>;
    fn get_nodes(&self, project_id: i64) -> Result<Vec<Node>, AppError>;
    fn update_node(&self, id: i64, title: &str, desc: Option<&str>) -> Result<(), AppError>;
    fn delete_node(&self, id: i64) -> Result<(), AppError>;

    // ── Files ────────────────────────────────────────────
    fn add_file_to_node(&self, node_id: i64, file: NodeFile) -> Result<(), AppError>;
    fn remove_file_from_node(&self, node_id: i64, file_idx: usize) -> Result<(), AppError>;
    /// Read raw file bytes from disk (file data is no longer in SQLite).
    fn read_file_bytes(&self, node_id: i64, file_idx: usize) -> Result<Vec<u8>, AppError>;

    // ── Timeline ─────────────────────────────────────────
    fn add_timeline_entry(&self, node_id: i64, entry: TimelineEntry) -> Result<(), AppError>;
    fn update_timeline_entry(&self, node_id: i64, entry_idx: usize, content: &str) -> Result<(), AppError>;
    fn delete_timeline_entry(&self, node_id: i64, entry_idx: usize) -> Result<(), AppError>;

    // ── Export / Import ──────────────────────────────────
    fn export_all(&self) -> Result<String, AppError>;
    /// Import folders, projects, and nodes from parsed JSON.
    fn import_all(
        &self,
        folders: Vec<Folder>,
        projects: Vec<Project>,
        nodes: Vec<Node>,
    ) -> Result<(), AppError>;

    // ── API Configs ────────────────────────────────────────
    fn create_api_config(
        &self,
        name: &str,
        api_key: &str,
        base_url: &str,
        model: &str,
        system_prompt: &str,
    ) -> Result<ApiConfig, AppError>;
    fn get_api_configs(&self) -> Result<Vec<ApiConfig>, AppError>;
    fn update_api_config(
        &self,
        id: i64,
        name: &str,
        api_key: &str,
        base_url: &str,
        model: &str,
        system_prompt: &str,
    ) -> Result<(), AppError>;
    fn delete_api_config(&self, id: i64) -> Result<(), AppError>;

    // ── Chat Sessions ───────────────────────────────────────
    fn create_chat_session(&self, title: &str, model_config_id: Option<i64>, context_json: &str) -> Result<ChatSession, AppError>;
    fn get_chat_sessions(&self) -> Result<Vec<ChatSession>, AppError>;
    fn update_chat_session(&self, id: i64, title: &str, model_config_id: Option<i64>, context_json: &str) -> Result<(), AppError>;
    fn delete_chat_session(&self, id: i64) -> Result<(), AppError>;

    // ── Search ────────────────────────────────────────────
    fn search_nodes(&self, query: &str) -> Result<Vec<SearchResult>, AppError>;

    // ── Chat Messages ───────────────────────────────────────
    fn add_chat_message(&self, session_id: i64, role: &str, content: &str) -> Result<ChatMessage, AppError>;
    fn get_chat_messages(&self, session_id: i64) -> Result<Vec<ChatMessage>, AppError>;
}
