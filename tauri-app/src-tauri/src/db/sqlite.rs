use crate::db::migration;
use crate::error::AppError;
use crate::models::{Folder, Project, Node, NodeFile, TimelineEntry, ApiConfig, ChatSession, ChatMessage, SearchResult};
use crate::storage::Storage;
use chrono::Local;
use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct SqliteStorage {
    conn: Mutex<Connection>,
}

impl SqliteStorage {
    #[doc(hidden)]
    pub fn new_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        migration::run_migrations(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

impl SqliteStorage {
    pub fn new(app_dir: PathBuf) -> Result<Self, AppError> {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("data.db");
        let conn = Connection::open(db_path)?;
        migration::run_migrations(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Calculate nesting depth of a folder (root = 1).
    fn folder_depth_inner(&self, conn: &Connection, folder_id: i64, depth: i32) -> Result<i32, AppError> {
        if depth > 4 {
            return Ok(depth);
        }
        let parent_id: Option<i64> = conn
            .query_row(
                "SELECT parent_id FROM folders WHERE id = ?1",
                params![folder_id],
                |row| row.get(0),
            )
            .ok()
            .flatten();
        match parent_id {
            Some(pid) => self.folder_depth_inner(conn, pid, depth + 1),
            None => Ok(depth),
        }
    }

    fn delete_folder_recursive(&self, conn: &Connection, folder_id: i64) -> Result<(), AppError> {
        // Delete child folders recursively
        let mut stmt = conn.prepare("SELECT id FROM folders WHERE parent_id = ?1")?;
        let child_ids: Vec<i64> = stmt
            .query_map(params![folder_id], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        for child_id in child_ids {
            self.delete_folder_recursive(conn, child_id)?;
        }
        // Nullify project references to this folder
        conn.execute(
            "UPDATE projects SET folder_id = NULL WHERE folder_id = ?1",
            params![folder_id],
        )?;
        // Delete the folder itself
        conn.execute("DELETE FROM folders WHERE id = ?1", params![folder_id])?;
        Ok(())
    }
}

impl Storage for SqliteStorage {
    // ── Folders ──────────────────────────────────────────

    fn create_folder(&self, name: &str, parent_id: Option<i64>) -> Result<Folder, AppError> {
        let now = Local::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();

        // Enforce max 4 levels of nesting
        if let Some(pid) = parent_id {
            let depth = self.folder_depth_inner(&conn, pid, 1)?;
            if depth >= 4 {
                return Err(AppError::Other("Maximum folder nesting depth (4) reached".into()));
            }
        }

        conn.execute(
            "INSERT INTO folders (name, parent_id, created_at) VALUES (?1, ?2, ?3)",
            params![name, parent_id, now],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Folder {
            id: Some(id),
            name: name.to_string(),
            parent_id,
            created_at: now,
        })
    }

    fn get_folders(&self) -> Result<Vec<Folder>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, parent_id, created_at FROM folders ORDER BY id")?;
        let folders = stmt
            .query_map([], |row| {
                Ok(Folder {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(folders)
    }

    fn update_folder(&self, id: i64, name: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE folders SET name = ?1 WHERE id = ?2", params![name, id])?;
        Ok(())
    }

    fn move_folder(&self, id: i64, new_parent_id: Option<i64>) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        if new_parent_id == Some(id) {
            return Err(AppError::Other("Cannot move folder under itself".into()));
        }
        if let Some(pid) = new_parent_id {
            // Check for cycles: pid must not be a descendant of id
            let mut current = Some(pid);
            while let Some(cid) = current {
                if cid == id {
                    return Err(AppError::Other("Cannot move folder under its own descendant".into()));
                }
                current = conn.query_row(
                    "SELECT parent_id FROM folders WHERE id = ?1",
                    params![cid],
                    |row| row.get(0),
                ).ok().flatten();
            }
            // Depth validation
            let depth = self.folder_depth_inner(&conn, pid, 1)?;
            if depth >= 4 {
                return Err(AppError::Other("Maximum folder nesting depth (4) reached".into()));
            }
        }
        conn.execute("UPDATE folders SET parent_id = ?1 WHERE id = ?2", params![new_parent_id, id])?;
        Ok(())
    }

    fn delete_folder(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        self.delete_folder_recursive(&conn, id)?;
        Ok(())
    }

    // ── Projects ─────────────────────────────────────────

    fn create_project(
        &self,
        name: &str,
        desc: Option<&str>,
        folder_id: Option<i64>,
    ) -> Result<Project, AppError> {
        let now = Local::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (name, desc, folder_id, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![name, desc, folder_id, now],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Project {
            id: Some(id),
            name: name.to_string(),
            desc: desc.map(|s| s.to_string()),
            folder_id,
            created_at: now,
        })
    }

    fn get_projects(&self) -> Result<Vec<Project>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT id, name, desc, folder_id, created_at FROM projects ORDER BY id")?;
        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    desc: row.get(2)?,
                    folder_id: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(projects)
    }

    fn update_project(&self, id: i64, name: &str, desc: Option<&str>, folder_id: Option<i64>) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET name = ?1, desc = ?2, folder_id = ?3 WHERE id = ?4",
            params![name, desc, folder_id, id],
        )?;
        Ok(())
    }

    fn move_project(&self, id: i64, new_folder_id: Option<i64>) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE projects SET folder_id = ?1 WHERE id = ?2", params![new_folder_id, id])?;
        Ok(())
    }

    fn delete_project(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM nodes WHERE project_id = ?1", params![id])?;
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Nodes ────────────────────────────────────────────

    fn create_node(
        &self,
        project_id: i64,
        title: &str,
        desc: Option<&str>,
    ) -> Result<Node, AppError> {
        let now = Local::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO nodes (project_id, title, desc, files, timeline, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_id, title, desc, "[]", "[]", now],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Node {
            id: Some(id),
            project_id,
            title: title.to_string(),
            desc: desc.map(|s| s.to_string()),
            files: vec![],
            timeline: vec![],
            created_at: now,
        })
    }

    fn get_nodes(&self, project_id: i64) -> Result<Vec<Node>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, desc, files, timeline, created_at FROM nodes WHERE project_id = ?1 ORDER BY id",
        )?;
        let nodes = stmt
            .query_map(params![project_id], |row| {
                let files_str: String = row.get(4)?;
                let timeline_str: String = row.get(5)?;
                let files: Vec<NodeFile> =
                    serde_json::from_str(&files_str).unwrap_or_default();
                let timeline: Vec<TimelineEntry> =
                    serde_json::from_str(&timeline_str).unwrap_or_default();
                Ok(Node {
                    id: Some(row.get(0)?),
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    desc: row.get(3)?,
                    files,
                    timeline,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(nodes)
    }

    fn update_node(&self, id: i64, title: &str, desc: Option<&str>) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE nodes SET title = ?1, desc = ?2 WHERE id = ?3",
            params![title, desc, id],
        )?;
        Ok(())
    }

    fn delete_node(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM nodes WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Files ────────────────────────────────────────────

    fn add_file_to_node(&self, node_id: i64, file: NodeFile) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT files FROM nodes WHERE id = ?1")?;
        let files_str: String = stmt.query_row(params![node_id], |row| row.get(0))?;
        let mut files: Vec<NodeFile> = serde_json::from_str(&files_str).unwrap_or_default();
        files.push(file);
        let new_files_str = serde_json::to_string(&files).unwrap();
        conn.execute(
            "UPDATE nodes SET files = ?1 WHERE id = ?2",
            params![new_files_str, node_id],
        )?;
        Ok(())
    }

    fn remove_file_from_node(&self, node_id: i64, file_idx: usize) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT files FROM nodes WHERE id = ?1")?;
        let files_str: String = stmt.query_row(params![node_id], |row| row.get(0))?;
        let mut files: Vec<NodeFile> = serde_json::from_str(&files_str).unwrap_or_default();
        if file_idx < files.len() {
            files.remove(file_idx);
            let new_files_str = serde_json::to_string(&files).unwrap();
            conn.execute(
                "UPDATE nodes SET files = ?1 WHERE id = ?2",
                params![new_files_str, node_id],
            )?;
        }
        Ok(())
    }

    fn read_file_bytes(&self, node_id: i64, file_idx: usize) -> Result<Vec<u8>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT files FROM nodes WHERE id = ?1")?;
        let files_str: String = stmt.query_row(params![node_id], |row| row.get(0))?;
        let files: Vec<NodeFile> = serde_json::from_str(&files_str).unwrap_or_default();
        let file = files.get(file_idx).ok_or_else(|| AppError::Other("File index out of range".into()))?;

        // Read from disk if path is set
        if !file.path.is_empty() {
            let bytes = std::fs::read(&file.path)?;
            return Ok(bytes);
        }

        // Fallback: decode from base64 data
        if let Some(ref data) = file.data {
            let base64_str = if let Some(idx) = data.find(";base64,") {
                &data[idx + 8..]
            } else {
                data
            };
            let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, base64_str)?;
            return Ok(bytes);
        }

        Err(AppError::Other("No file data available".into()))
    }

    // ── Timeline ─────────────────────────────────────────

    fn add_timeline_entry(&self, node_id: i64, entry: TimelineEntry) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT timeline FROM nodes WHERE id = ?1")?;
        let timeline_str: String = stmt.query_row(params![node_id], |row| row.get(0))?;
        let mut timeline: Vec<TimelineEntry> =
            serde_json::from_str(&timeline_str).unwrap_or_default();
        timeline.push(entry);
        let new_timeline_str = serde_json::to_string(&timeline).unwrap();
        conn.execute(
            "UPDATE nodes SET timeline = ?1 WHERE id = ?2",
            params![new_timeline_str, node_id],
        )?;
        Ok(())
    }

    fn update_timeline_entry(&self, node_id: i64, entry_idx: usize, content: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT timeline FROM nodes WHERE id = ?1")?;
        let timeline_str: String = stmt.query_row(params![node_id], |row| row.get(0))?;
        let mut timeline: Vec<TimelineEntry> =
            serde_json::from_str(&timeline_str).unwrap_or_default();
        if entry_idx < timeline.len() {
            timeline[entry_idx].content = content.to_string();
        }
        let new_timeline_str = serde_json::to_string(&timeline).unwrap();
        conn.execute(
            "UPDATE nodes SET timeline = ?1 WHERE id = ?2",
            params![new_timeline_str, node_id],
        )?;
        Ok(())
    }

    fn delete_timeline_entry(&self, node_id: i64, entry_idx: usize) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT timeline FROM nodes WHERE id = ?1")?;
        let timeline_str: String = stmt.query_row(params![node_id], |row| row.get(0))?;
        let mut timeline: Vec<TimelineEntry> =
            serde_json::from_str(&timeline_str).unwrap_or_default();
        if entry_idx < timeline.len() {
            timeline.remove(entry_idx);
        }
        let new_timeline_str = serde_json::to_string(&timeline).unwrap();
        conn.execute(
            "UPDATE nodes SET timeline = ?1 WHERE id = ?2",
            params![new_timeline_str, node_id],
        )?;
        Ok(())
    }

    // ── Export / Import ──────────────────────────────────

    fn export_all(&self) -> Result<String, AppError> {
        let folders = self.get_folders()?;
        let projects = self.get_projects()?;
        let mut all_nodes: Vec<Node> = vec![];
        for p in &projects {
            if let Some(pid) = p.id {
                let nodes = self.get_nodes(pid)?;
                all_nodes.extend(nodes);
            }
        }
        #[derive(serde::Serialize)]
        struct ExportData {
            folders: Vec<Folder>,
            projects: Vec<Project>,
            nodes: Vec<Node>,
        }
        let export = ExportData {
            folders,
            projects,
            nodes: all_nodes,
        };
        Ok(serde_json::to_string_pretty(&export).unwrap())
    }

    fn import_all(
        &self,
        folders: Vec<Folder>,
        projects: Vec<Project>,
        nodes: Vec<Node>,
    ) -> Result<(), AppError> {
        for folder in folders {
            self.create_folder(&folder.name, folder.parent_id)?;
        }
        for project in projects {
            self.create_project(&project.name, project.desc.as_deref(), project.folder_id)?;
        }
        for node in nodes {
            self.create_node(node.project_id, &node.title, node.desc.as_deref())?;
        }
        Ok(())
    }

    // ── API Configs ────────────────────────────────────────

    fn create_api_config(
        &self,
        name: &str,
        api_key: &str,
        base_url: &str,
        model: &str,
        system_prompt: &str,
    ) -> Result<ApiConfig, AppError> {
        let now = Local::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO api_configs (name, api_key, base_url, model, system_prompt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![name, api_key, base_url, model, system_prompt, now],
        )?;
        let id = conn.last_insert_rowid();
        Ok(ApiConfig {
            id: Some(id),
            name: name.to_string(),
            api_key: api_key.to_string(),
            base_url: base_url.to_string(),
            model: model.to_string(),
            system_prompt: system_prompt.to_string(),
            created_at: now,
        })
    }

    fn get_api_configs(&self) -> Result<Vec<ApiConfig>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, api_key, base_url, model, system_prompt, created_at FROM api_configs ORDER BY id"
        )?;
        let configs = stmt
            .query_map([], |row| {
                Ok(ApiConfig {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    api_key: row.get(2)?,
                    base_url: row.get(3)?,
                    model: row.get(4)?,
                    system_prompt: row.get::<_, String>(5).unwrap_or_default(),
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(configs)
    }

    fn update_api_config(
        &self,
        id: i64,
        name: &str,
        api_key: &str,
        base_url: &str,
        model: &str,
        system_prompt: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE api_configs SET name = ?1, api_key = ?2, base_url = ?3, model = ?4, system_prompt = ?5 WHERE id = ?6",
            params![name, api_key, base_url, model, system_prompt, id],
        )?;
        Ok(())
    }

    fn delete_api_config(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM api_configs WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Chat Sessions ───────────────────────────────────────

    fn create_chat_session(&self, title: &str, model_config_id: Option<i64>, context_json: &str) -> Result<ChatSession, AppError> {
        let now = Local::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chat_sessions (title, model_config_id, context_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![title, model_config_id, context_json, now, now],
        )?;
        let id = conn.last_insert_rowid();
        Ok(ChatSession {
            id: Some(id),
            title: title.to_string(),
            model_config_id,
            context_json: context_json.to_string(),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    fn get_chat_sessions(&self) -> Result<Vec<ChatSession>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, model_config_id, context_json, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC"
        )?;
        let sessions = stmt
            .query_map([], |row| {
                Ok(ChatSession {
                    id: Some(row.get(0)?),
                    title: row.get(1)?,
                    model_config_id: row.get(2)?,
                    context_json: row.get::<_, String>(3).unwrap_or_default(),
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(sessions)
    }

    fn update_chat_session(&self, id: i64, title: &str, model_config_id: Option<i64>, context_json: &str) -> Result<(), AppError> {
        let now = Local::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE chat_sessions SET title = ?1, model_config_id = ?2, context_json = ?3, updated_at = ?4 WHERE id = ?5",
            params![title, model_config_id, context_json, now, id],
        )?;
        Ok(())
    }

    fn delete_chat_session(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?1", params![id])?;
        conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Search ────────────────────────────────────────────

    fn search_nodes(&self, query: &str) -> Result<Vec<SearchResult>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut results = Vec::new();

        // FTS5 search on nodes
        let fts_query = query.split_whitespace()
            .map(|w| format!("\"{}\"*", w.replace('"', "")))
            .collect::<Vec<_>>()
            .join(" ");
        let mut stmt = conn.prepare(
            "SELECT n.id, n.title, n.project_id, p.name FROM nodes_fts f
             JOIN nodes n ON f.rowid = n.id
             JOIN projects p ON n.project_id = p.id
             WHERE nodes_fts MATCH ?1
             ORDER BY rank
             LIMIT 20"
        )?;
        let node_results: Vec<SearchResult> = stmt
            .query_map(params![fts_query], |row| {
                Ok(SearchResult {
                    result_type: "node".into(),
                    name: row.get(1)?,
                    project_id: row.get(2)?,
                    project_name: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        results.extend(node_results);

        // LIKE search on project names and descriptions
        let like_query = format!("%{}%", query.replace('%', "").replace('_', ""));
        let mut stmt = conn.prepare(
            "SELECT id, name, COALESCE(desc, '') FROM projects WHERE name LIKE ?1 OR desc LIKE ?1 LIMIT 10"
        )?;
        let project_results: Vec<SearchResult> = stmt
            .query_map(params![like_query], |row| {
                Ok(SearchResult {
                    result_type: "project".into(),
                    name: row.get(1)?,
                    project_id: row.get(0)?,
                    project_name: row.get(1)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        results.extend(project_results);

        Ok(results)
    }

    // ── Chat Messages ───────────────────────────────────────

    fn add_chat_message(&self, session_id: i64, role: &str, content: &str) -> Result<ChatMessage, AppError> {
        let now = Local::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![session_id, role, content, now],
        )?;
        let id = conn.last_insert_rowid();
        // Update session updated_at
        conn.execute(
            "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
            params![now, session_id],
        )?;
        Ok(ChatMessage {
            id: Some(id),
            session_id,
            role: role.to_string(),
            content: content.to_string(),
            created_at: now,
        })
    }

    fn get_chat_messages(&self, session_id: i64) -> Result<Vec<ChatMessage>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, created_at FROM chat_messages WHERE session_id = ?1 ORDER BY id"
        )?;
        let msgs = stmt
            .query_map(params![session_id], |row| {
                Ok(ChatMessage {
                    id: Some(row.get(0)?),
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(msgs)
    }
}
