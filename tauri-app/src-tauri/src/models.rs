use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Folder {
    pub id: Option<i64>,
    pub name: String,
    pub parent_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: Option<i64>,
    pub name: String,
    pub desc: Option<String>,
    pub folder_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Node {
    pub id: Option<i64>,
    pub project_id: i64,
    pub title: String,
    pub desc: Option<String>,
    pub files: Vec<NodeFile>,
    pub timeline: Vec<TimelineEntry>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeFile {
    pub name: String,
    pub path: String,
    pub size: Option<i64>,
    pub data: Option<String>,
    pub added_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEntry {
    pub content: String,
    pub time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSession {
    pub id: Option<i64>,
    pub title: String,
    pub model_config_id: Option<i64>,
    pub context_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: Option<i64>,
    pub session_id: i64,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub result_type: String,
    pub name: String,
    pub project_id: i64,
    pub project_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiConfig {
    pub id: Option<i64>,
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub system_prompt: String,
    pub created_at: String,
}
