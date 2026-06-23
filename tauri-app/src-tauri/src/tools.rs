// ── AI Function-Calling Tools ──────────────────────────────────
// Defines tools the AI can invoke to read/write project data.
// Currently reserved — wire up execute_tool to enable.

use crate::error::AppError;

/// One tool's full definition (OpenAI function-calling shape).
pub struct ToolDef {
    pub name: &'static str,
    pub description: &'static str,
    pub parameters: serde_json::Value,
}

/// Schema for a single parameter field.
fn param(ty: &str, desc: &str) -> serde_json::Value {
    serde_json::json!({ "type": ty, "description": desc })
}

// ── Registry ─────────────────────────────────────────────────

/// All tools the AI can call. Add new tools here, then handle in `execute_tool`.
pub fn all_tools() -> Vec<ToolDef> {
    vec![
        // ── Folders ──
        ToolDef {
            name: "create_folder",
            description: "Create a new folder. parent_id is optional (null = root level).",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "name":      param("string", "Folder name"),
                    "parent_id": param("integer", "Parent folder ID, or null for root")
                },
                "required": ["name"]
            }),
        },
        ToolDef {
            name: "update_folder",
            description: "Rename an existing folder.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "id":   param("integer", "Folder ID to rename"),
                    "name": param("string", "New folder name")
                },
                "required": ["id", "name"]
            }),
        },
        ToolDef {
            name: "delete_folder",
            description: "Delete a folder and all its sub-folders. Projects inside are kept (moved to root).",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "id": param("integer", "Folder ID to delete")
                },
                "required": ["id"]
            }),
        },
        // ── Projects ──
        ToolDef {
            name: "create_project",
            description: "Create a new project, optionally inside a folder.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "name":      param("string", "Project name"),
                    "desc":      param("string", "Optional description"),
                    "folder_id": param("integer", "Folder ID, or null for root")
                },
                "required": ["name"]
            }),
        },
        ToolDef {
            name: "update_project",
            description: "Rename, re-describe, or move a project.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "id":        param("integer", "Project ID"),
                    "name":      param("string", "New name"),
                    "desc":      param("string", "New description"),
                    "folder_id": param("integer", "New folder ID, or null")
                },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "delete_project",
            description: "Delete a project and all its nodes.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "id": param("integer", "Project ID to delete")
                },
                "required": ["id"]
            }),
        },
        // ── Nodes ──
        ToolDef {
            name: "create_node",
            description: "Create a new node (task / note) in a project.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_id": param("integer", "Project to add the node to"),
                    "title":      param("string", "Node title"),
                    "desc":       param("string", "Optional description / body")
                },
                "required": ["project_id", "title"]
            }),
        },
        ToolDef {
            name: "update_node",
            description: "Edit a node's title or description.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "id":    param("integer", "Node ID to edit"),
                    "title": param("string", "New title"),
                    "desc":  param("string", "New description")
                },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "delete_node",
            description: "Delete a node.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "id": param("integer", "Node ID to delete")
                },
                "required": ["id"]
            }),
        },
        // ── Timeline ──
        ToolDef {
            name: "add_timeline_entry",
            description: "Add a timeline / progress entry to a node.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "node_id": param("integer", "Node ID to add the entry to"),
                    "content": param("string", "Entry text")
                },
                "required": ["node_id", "content"]
            }),
        },
        // ── Search ──
        ToolDef {
            name: "search_nodes",
            description: "Search all node titles and descriptions for a keyword.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": param("string", "Search keyword")
                },
                "required": ["query"]
            }),
        },
        // ── Stats ──
        ToolDef {
            name: "get_stats",
            description: "Get project statistics: folder count, project count, node count.",
            parameters: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
        },
    ]
}

/// Convert our tool definitions into the OpenAI `tools` array format.
pub fn to_openai_tools() -> Vec<serde_json::Value> {
    all_tools()
        .iter()
        .map(|t| {
            serde_json::json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters
                }
            })
        })
        .collect()
}

// ── Execution (reserved) ─────────────────────────────────────
// TODO: Hook up to Storage trait + frontend for full function-calling.
//
// Flow:
//   1. Frontend calls chat with `tools: to_openai_tools()` in the request
//   2. AI responds with a `tool_calls` array instead of text
//   3. Rust iterates `tool_calls`, calls `execute_tool()` for each
//   4. Results are fed back to AI as `role: "tool"` messages
//   5. AI produces the final text response from tool results
//
// To enable: call this from services::call_ai_stream when the API
// returns `finish_reason: "tool_calls"` instead of `"stop"`.

#[allow(dead_code)]
pub fn execute_tool(
    name: &str,
    args: &serde_json::Value,
    storage: &dyn crate::storage::Storage,
) -> Result<String, AppError> {
    match name {
        "create_folder" => {
            let name = args["name"].as_str().ok_or("name required")?;
            let pid = args["parent_id"].as_i64();
            let f = storage.create_folder(name, pid)?;
            Ok(format!("Folder '{}' created (id={})", f.name, f.id.unwrap_or(0)))
        }
        "update_folder" => {
            let id = args["id"].as_i64().ok_or("id required")?;
            let name = args["name"].as_str().ok_or("name required")?;
            storage.update_folder(id, name)?;
            Ok(format!("Folder updated to '{}'", name))
        }
        "delete_folder" => {
            let id = args["id"].as_i64().ok_or("id required")?;
            storage.delete_folder(id)?;
            Ok(format!("Folder {} deleted", id))
        }
        "create_project" => {
            let name = args["name"].as_str().ok_or("name required")?;
            let desc = args["desc"].as_str();
            let fid = args["folder_id"].as_i64();
            let p = storage.create_project(name, desc, fid)?;
            Ok(format!("Project '{}' created (id={})", p.name, p.id.unwrap_or(0)))
        }
        "update_project" => {
            let id = args["id"].as_i64().ok_or("id required")?;
            let name = args["name"].as_str().ok_or("name required")?;
            let desc = args["desc"].as_str();
            let fid = args["folder_id"].as_i64();
            storage.update_project(id, name, desc, fid)?;
            Ok(format!("Project updated to '{}'", name))
        }
        "delete_project" => {
            let id = args["id"].as_i64().ok_or("id required")?;
            storage.delete_project(id)?;
            Ok(format!("Project {} deleted", id))
        }
        "create_node" => {
            let pid = args["project_id"].as_i64().ok_or("project_id required")?;
            let title = args["title"].as_str().ok_or("title required")?;
            let desc = args["desc"].as_str();
            let n = storage.create_node(pid, title, desc)?;
            Ok(format!("Node '{}' created (id={})", n.title, n.id.unwrap_or(0)))
        }
        "update_node" => {
            let id = args["id"].as_i64().ok_or("id required")?;
            let title = args["title"].as_str().ok_or("title required")?;
            let desc = args["desc"].as_str();
            storage.update_node(id, title, desc)?;
            Ok(format!("Node updated to '{}'", title))
        }
        "delete_node" => {
            let id = args["id"].as_i64().ok_or("id required")?;
            storage.delete_node(id)?;
            Ok(format!("Node {} deleted", id))
        }
        "add_timeline_entry" => {
            let node_id = args["node_id"].as_i64().ok_or("node_id required")?;
            let content = args["content"].as_str().ok_or("content required")?;
            let entry = crate::models::TimelineEntry {
                content: content.to_string(),
                time: chrono::Local::now().to_rfc3339(),
            };
            storage.add_timeline_entry(node_id, entry)?;
            Ok("Timeline entry added".into())
        }
        "search_nodes" => {
            let query = args["query"].as_str().ok_or("query required")?;
            // Search across all projects — collect matching nodes
            let projects = storage.get_projects()?;
            let mut results = Vec::new();
            for p in &projects {
                if let Some(pid) = p.id {
                    let nodes = storage.get_nodes(pid)?;
                    for n in &nodes {
                        let title_match = n.title.to_lowercase().contains(&query.to_lowercase());
                        let desc_match = n.desc.as_deref().unwrap_or("").to_lowercase().contains(&query.to_lowercase());
                        if title_match || desc_match {
                            let proj_name = &p.name;
                            results.push(format!("[{}] {} (project: {})", n.id.unwrap_or(0), n.title, proj_name));
                        }
                    }
                }
            }
            if results.is_empty() {
                Ok("No matching nodes found.".into())
            } else {
                Ok(results.join("\n"))
            }
        }
        "get_stats" => {
            let folders = storage.get_folders()?.len();
            let projects = storage.get_projects()?.len();
            let mut nodes = 0;
            for p in &storage.get_projects()? {
                if let Some(pid) = p.id {
                    nodes += storage.get_nodes(pid)?.len();
                }
            }
            Ok(format!("{} folders, {} projects, {} nodes", folders, projects, nodes))
        }
        _ => Err(AppError::Other(format!("Unknown tool: {}", name))),
    }
}
