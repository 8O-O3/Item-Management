// ── Tauri IPC Wrappers ──────────────────────────────────────────
// Every backend command gets a typed async wrapper here.

function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
}

// ── Folders ─────────────────────────────────────────────────────

export async function fetchFolders() {
    return invoke('get_folders');
}

export async function createFolder(name, parentId) {
    return invoke('create_folder', { name, parentId });
}

export async function updateFolder(id, name) {
    return invoke('update_folder', { id, name });
}

export async function moveFolder(id, newParentId) {
    return invoke('move_folder', { id, newParentId });
}

export async function deleteFolder(id) {
    return invoke('delete_folder', { id });
}

// ── Projects ────────────────────────────────────────────────────

export async function fetchProjects() {
    return invoke('get_projects');
}

export async function createProject(name, desc, folderId) {
    return invoke('create_project', { name, desc, folderId });
}

export async function updateProject(id, name, desc, folderId) {
    return invoke('update_project', { id, name, desc, folderId });
}

export async function moveProject(id, newFolderId) {
    return invoke('move_project', { id, newFolderId });
}

export async function deleteProject(id) {
    return invoke('delete_project', { id });
}

// ── Nodes ───────────────────────────────────────────────────────

export async function fetchNodes(projectId) {
    return invoke('get_nodes', { projectId });
}

export async function createNode(projectId, title, desc) {
    return invoke('create_node', { projectId, title, desc });
}

export async function updateNode(id, title, desc) {
    return invoke('update_node', { id, title, desc });
}

export async function deleteNode(id) {
    return invoke('delete_node', { id });
}

// ── Files ───────────────────────────────────────────────────────

export async function addFileToNode(nodeId, name, path, size, data) {
    return invoke('add_file_to_node', { nodeId, name, path, size, data });
}

export async function removeFileFromNode(nodeId, fileIdx) {
    return invoke('remove_file_from_node', { nodeId, fileIdx });
}

export async function saveNodeFile(data, path) {
    return invoke('save_node_file', { data, path });
}

export async function readFileBytes(nodeId, fileIdx) {
    return invoke('read_file_bytes', { nodeId, fileIdx });
}

// ── Timeline ────────────────────────────────────────────────────

export async function addTimelineEntry(nodeId, content) {
    return invoke('add_timeline_entry', { nodeId, content });
}

// ── Export / Import ─────────────────────────────────────────────

export async function exportData() {
    return invoke('export_data');
}

export async function saveExport(path) {
    return invoke('save_export', { path });
}

export async function importData(jsonData) {
    return invoke('import_data', { jsonData });
}

// ── Misc ────────────────────────────────────────────────────────

export async function extractDocxText(data) {
    return invoke('extract_docx_text', { data });
}

export async function openAppDir() {
    return invoke('open_app_dir');
}

// ── Version ─────────────────────────────────────────────────────

export async function getVersion() {
    return invoke('get_version');
}

// ── API Configs ──────────────────────────────────────────────────

export async function fetchApiConfigs() {
    return invoke('get_api_configs');
}

export async function createApiConfig(name, apiKey, baseUrl, model, systemPrompt) {
    return invoke('create_api_config', { name, apiKey, baseUrl, model, systemPrompt });
}

export async function updateApiConfig(id, name, apiKey, baseUrl, model, systemPrompt) {
    return invoke('update_api_config', { id, name, apiKey, baseUrl, model, systemPrompt });
}

export async function deleteApiConfig(id) {
    return invoke('delete_api_config', { id });
}

// ── AI ──────────────────────────────────────────────────────────

export async function callAiApi(apiKey, baseUrl, model, messagesJson) {
    return invoke('call_ai_api', { apiKey, baseUrl, model, messagesJson });
}

export async function callAiStream(apiKey, baseUrl, model, messagesJson) {
    return invoke('call_ai_stream', { apiKey, baseUrl, model, messagesJson });
}

export async function cancelAiStream() {
    return invoke('cancel_ai_stream');
}

// ── Search ────────────────────────────────────────────────────────

export async function search(query) {
    return invoke('search_all', { query });
}

// ── Chat Sessions ──────────────────────────────────────────

export async function createChatSession(title, modelConfigId, contextJson) {
    return invoke('create_chat_session', { title, modelConfigId, contextJson });
}

export async function getChatSessions() {
    return invoke('get_chat_sessions');
}

export async function updateChatSession(id, title, modelConfigId, contextJson) {
    return invoke('update_chat_session', { id, title, modelConfigId, contextJson });
}

export async function deleteChatSession(id) {
    return invoke('delete_chat_session', { id });
}

// ── Chat Messages ──────────────────────────────────────────

export async function addChatMessage(sessionId, role, content) {
    return invoke('add_chat_message', { sessionId, role, content });
}

export async function getChatMessages(sessionId) {
    return invoke('get_chat_messages', { sessionId });
}
