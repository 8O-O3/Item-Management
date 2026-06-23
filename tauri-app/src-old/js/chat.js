// ── AI Chat Panel ───────────────────────────────────────────────

import { get, set } from './store.js';
import * as api from './api.js';
import { escapeHtml, formatSize, showError } from './utils.js';

let chatMessages = [];
let chatLoading = false;
let currentStreamUnlisten = null;

export function toggleChat() {
    const panel = document.getElementById('chatPanel');
    if (panel.classList.contains('active')) {
        closeChat();
    } else {
        openChat();
    }
}

function openChat() {
    document.getElementById('chatPanel').classList.add('active'); if (window.Alpine?.store('app')) Alpine.store('app').chatOpen = true;
    updateChatContextBadge();
    document.getElementById('chatInput').focus();
}

export function closeChat() {
    document.getElementById('chatPanel').classList.remove('active'); if (window.Alpine?.store('app')) Alpine.store('app').chatOpen = false;
}

export function clearChat() {
    chatMessages = [];
    set('chatContextSelections', { folderIds: [], projectIds: [], nodeIds: [] });
    set('currentSessionId', null);
    renderChatMessages();
    updateChatContextBadge();
}

// ── Context Picker ──────────────────────────────────────────────

function updateChatContextBadge() {
    const badge = document.getElementById('chatContextBadge');
    const sel = get('chatContextSelections');
    const projects = get('projects');
    // Count directly selected projects + projects from selected folders
    const expandedProjectIds = new Set(sel.projectIds || []);
    if (sel.folderIds) {
        sel.folderIds.forEach(function (fid) {
            projects.filter(function (p) { return p.folder_id === fid; }).forEach(function (p) {
                expandedProjectIds.add(p.id);
            });
        });
    }
    const count = expandedProjectIds.size + (sel.nodeIds || []).length;
    if (count > 0) {
        badge.textContent = 'Context: ' + count + ' item' + (count > 1 ? 's' : '');
        badge.style.display = 'inline-block';
        badge.style.cursor = 'pointer';
    } else {
        badge.textContent = 'Context: none';
        badge.style.display = 'inline-block';
        badge.style.cursor = 'pointer';
    }
}

function buildContextFromSelections() {
    const folders = get('folders');
    const projects = get('projects');
    const sel = get('chatContextSelections');
    let ctx = '=== SELECTED CONTEXT ===\n';

    // Collect all selected project IDs (directly selected + via folders)
    const expandedProjectIds = new Set(sel.projectIds || []);
    if (sel.folderIds) {
        sel.folderIds.forEach(function (fid) {
            projects.filter(function (p) { return p.folder_id === fid; }).forEach(function (p) {
                expandedProjectIds.add(p.id);
            });
        });
    }

    if (expandedProjectIds.size === 0 && (sel.nodeIds || []).length === 0) {
        return 'No context selected.';
    }

    expandedProjectIds.forEach(function (pid) {
        const p = projects.find(function (x) { return x.id === pid; });
        if (!p) return;
        ctx += 'Project: ' + p.name + ' (id=' + p.id + ')\n';
        if (p.desc) ctx += '  Description: ' + p.desc + '\n';
    });

    // Add node details with file info from the current cached nodes
    // We fetch relevant project nodes on demand in sendChatMessage
    if (sel.nodeIds && sel.nodeIds.length > 0) {
        ctx += '\nSpecific nodes requested.\n';
    }

    return ctx;
}

async function buildFullContext() {
    const sel = get('chatContextSelections');
    const projects = get('projects');
    let ctx = buildContextFromSelections();
    const nodeIds = sel.nodeIds || [];

    // Collect all expanded project IDs (direct + via folders)
    const expandedProjectIds = new Set(sel.projectIds || []);
    if (sel.folderIds) {
        sel.folderIds.forEach(function (fid) {
            projects.filter(function (p) { return p.folder_id === fid; }).forEach(function (p) {
                expandedProjectIds.add(p.id);
            });
        });
    }

    if (expandedProjectIds.size === 0 && nodeIds.length === 0) return ctx;

    // Fetch nodes for all selected projects
    const allNodes = [];
    for (var pid of expandedProjectIds) {
        try {
            const nodes = await api.fetchNodes(pid);
            allNodes.push(...nodes);
        } catch (e) { /* skip */ }
    }
    allNodes.push(...get('currentNodes'));

    // Deduplicate by id
    const seen = new Set();
    const uniqueNodes = allNodes.filter(function (n) { return seen.has(n.id) ? false : (seen.add(n.id), true); });

    if (nodeIds.length > 0) {
        // Only include specifically selected nodes with full details
        nodeIds.forEach(function (nid) {
            const node = uniqueNodes.find(function (n) { return n.id === nid; });
            if (node) {
                ctx += '\n--- Node: ' + node.title + ' ---\n';
                if (node.desc) ctx += '  Description: ' + node.desc + '\n';
                ctx += '  Files: ' + ((node.files || []).map(function (f) { return f.name + (f.size ? ' (' + formatSize(f.size) + ')' : ''); }).join(', ') || 'none') + '\n';
                ctx += '  Timeline entries (' + (node.timeline || []).length + '):\n';
                (node.timeline || []).forEach(function (t) {
                    ctx += '    - [' + t.time + '] ' + t.content + '\n';
                });
            }
        });
    } else {
        // Include ALL nodes from selected projects
        uniqueNodes.forEach(function (node) {
            ctx += '\n--- Node: ' + node.title + ' ---\n';
            if (node.desc) ctx += '  Description: ' + node.desc + '\n';
            ctx += '  Files: ' + ((node.files || []).map(function (f) { return f.name + (f.size ? ' (' + formatSize(f.size) + ')' : ''); }).join(', ') || 'none') + '\n';
            ctx += '  Timeline entries (' + (node.timeline || []).length + '):\n';
            (node.timeline || []).forEach(function (t) {
                ctx += '    - [' + t.time + '] ' + t.content + '\n';
            });
        });
    }

    return ctx;
}

let contextNodesCache = {};

async function loadContextNodes() {
    var projects = get('projects');
    var results = await Promise.all(projects.map(function (p) {
        return api.fetchNodes(p.id).then(function (nodes) {
            contextNodesCache[p.id] = nodes;
        }).catch(function () {
            contextNodesCache[p.id] = [];
        });
    }));
}

async function renderContextPicker() {
    var picker = document.getElementById('contextPicker');
    if (!picker) return;

    var folders = get('folders');
    var projects = get('projects');
    var sel = get('chatContextSelections');
    var selectedFolderIds = new Set(sel.folderIds || []);
    var selectedProjectIds = new Set(sel.projectIds || []);
    var selectedNodeIds = new Set(sel.nodeIds || []);

    var treeEl = document.getElementById('contextPickerTree');
    if (!treeEl) return;

    // Load nodes on first render, use cache for subsequent checkbox re-renders
    if (Object.keys(contextNodesCache).length === 0) {
        treeEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:12px;text-align:center;">Loading...</div>';
        await loadContextNodes();
    }

    var html = '';

    var rootFolders = folders.filter(function (f) { return !f.parent_id; });
    var rootProjects = projects.filter(function (p) { return !p.folder_id; });

    rootFolders.forEach(function (f) {
        html += renderContextFolder(f, 0, selectedFolderIds, selectedProjectIds, selectedNodeIds);
    });

    rootProjects.forEach(function (p) {
        html += renderContextProject(p, 0, selectedProjectIds, selectedNodeIds);
    });

    if (!html) {
        html = '<div style="padding:16px;color:var(--text-secondary);font-size:12px;text-align:center;">No projects yet</div>';
    }

    treeEl.innerHTML = html;

    // Bind checkbox events
    treeEl.querySelectorAll('.context-check[data-type="folder"]').forEach(function (cb) {
        cb.addEventListener('change', function () {
            var fid = parseInt(cb.dataset.id);
            var s = get('chatContextSelections');
            var folderIds = s.folderIds ? [...s.folderIds] : [];
            var projectIds = s.projectIds ? [...s.projectIds] : [];
            var nodeIds = s.nodeIds ? [...s.nodeIds] : [];
            if (cb.checked) {
                if (folderIds.indexOf(fid) === -1) folderIds.push(fid);
                // Auto-select all nodes under all projects in this folder (and sub-folders)
                var allProjs = getProjectsInFolderRecursive(fid);
                allProjs.forEach(function (p) {
                    var pidx = projectIds.indexOf(p.id);
                    if (pidx !== -1) projectIds.splice(pidx, 1);
                    var cachedNodes = contextNodesCache[p.id] || [];
                    cachedNodes.forEach(function (n) {
                        if (nodeIds.indexOf(n.id) === -1) nodeIds.push(n.id);
                    });
                });
            } else {
                folderIds = folderIds.filter(function (id) { return id !== fid; });
                // Remove auto-selected nodes for projects under this folder
                var allProjs = getProjectsInFolderRecursive(fid);
                allProjs.forEach(function (p) {
                    var cachedNodes = contextNodesCache[p.id] || [];
                    cachedNodes.forEach(function (n) {
                        var nidx = nodeIds.indexOf(n.id);
                        if (nidx !== -1) nodeIds.splice(nidx, 1);
                    });
                });
            }
            set('chatContextSelections', { folderIds: folderIds, projectIds: projectIds, nodeIds: nodeIds });
            updateChatContextBadge();
            renderContextPicker();
        });
    });

    treeEl.querySelectorAll('.context-check[data-type="project"]').forEach(function (cb) {
        cb.addEventListener('change', function () {
            var pid = parseInt(cb.dataset.id);
            var s = get('chatContextSelections');
            var projectIds = s.projectIds ? [...s.projectIds] : [];
            var nodeIds = s.nodeIds ? [...s.nodeIds] : [];
            if (cb.checked) {
                if (projectIds.indexOf(pid) === -1) projectIds.push(pid);
            } else {
                projectIds = projectIds.filter(function (id) { return id !== pid; });
                // Remove nodes belonging to this unchecked project
                var cachedNodes = contextNodesCache[pid] || [];
                cachedNodes.forEach(function (n) {
                    var nidx = nodeIds.indexOf(n.id);
                    if (nidx !== -1) nodeIds.splice(nidx, 1);
                });
            }
            set('chatContextSelections', { folderIds: s.folderIds || [], projectIds: projectIds, nodeIds: nodeIds });
            updateChatContextBadge();
            renderContextPicker();
        });
    });

    treeEl.querySelectorAll('.context-check[data-type="node"]').forEach(function (cb) {
        cb.addEventListener('change', function () {
            var nid = parseInt(cb.dataset.id);
            var s = get('chatContextSelections');
            var nodeIds = s.nodeIds ? [...s.nodeIds] : [];
            if (cb.checked) {
                if (nodeIds.indexOf(nid) === -1) nodeIds.push(nid);
            } else {
                nodeIds = nodeIds.filter(function (id) { return id !== nid; });
            }
            set('chatContextSelections', { folderIds: s.folderIds || [], projectIds: s.projectIds || [], nodeIds: nodeIds });
            updateChatContextBadge();
            renderContextPicker();
        });
    });
}

function renderContextFolder(f, depth, selFolders, selProjects, selNodes) {
    var folders = get('folders');
    var projects = get('projects');
    var indent = depth * 16;
    var checked = selFolders.has(f.id) ? 'checked' : '';
    var childFolders = folders.filter(function (x) { return x.parent_id === f.id; });
    var childProjects = projects.filter(function (x) { return x.folder_id === f.id; });

    var html = '<div style="padding-left:' + indent + 'px;">';
    html += '<label class="context-item context-item-folder"><input type="checkbox" class="context-check" data-type="folder" data-id="' + f.id + '" ' + checked + '><span class="context-icon">&#128193;</span> ' + escapeHtml(f.name) + '</label>';
    childFolders.forEach(function (cf) { html += renderContextFolder(cf, depth + 1, selFolders, selProjects, selNodes); });
    childProjects.forEach(function (cp) { html += renderContextProject(cp, depth + 1, selProjects, selNodes); });
    html += '</div>';
    return html;
}

function renderContextProject(p, depth, selProjects, selNodes) {
    var indent = depth * 16;
    var checked = selProjects.has(p.id) ? 'checked' : '';
    var nodes = contextNodesCache[p.id] || [];

    var html = '<div style="padding-left:' + indent + 'px;">';
    html += '<label class="context-item context-item-project"><input type="checkbox" class="context-check" data-type="project" data-id="' + p.id + '" ' + checked + '><span class="context-icon">&#128196;</span> ' + escapeHtml(p.name) + '</label>';

    // Render nodes (files) under this project
    nodes.forEach(function (n) {
        var nodeChecked = selNodes.has(n.id) ? 'checked' : '';
        var fileCount = (n.files || []).length;
        html += '<label class="context-item context-item-node" style="padding-left:' + (indent + 24) + 'px;">';
        html += '<input type="checkbox" class="context-check" data-type="node" data-id="' + n.id + '" ' + nodeChecked + '>';
        html += '<span class="context-node-icon">&#128441;</span> ';
        html += '<span class="context-node-title">' + escapeHtml(n.title) + '</span>';
        if (fileCount > 0) {
            html += ' <span class="context-node-badge">' + fileCount + '</span>';
        }
        html += '</label>';
    });

    html += '</div>';
    return html;
}

async function toggleContextPicker() {
    var picker = document.getElementById('contextPicker');
    if (!picker) return;
    if (picker.style.display === 'block') {
        picker.style.display = 'none';
        contextNodesCache = {};
    } else {
        picker.style.display = 'block';
        await renderContextPicker();
    }
}

function getProjectsInFolderRecursive(folderId) {
    var folders = get('folders');
    var projects = get('projects');
    var result = [];
    // Direct child projects
    projects.filter(function (p) { return p.folder_id === folderId; }).forEach(function (p) {
        result.push(p);
    });
    // Recurse into child folders
    folders.filter(function (f) { return f.parent_id === folderId; }).forEach(function (childF) {
        result = result.concat(getProjectsInFolderRecursive(childF.id));
    });
    return result;
}

function closeContextPicker() {
    var picker = document.getElementById('contextPicker');
    if (picker) picker.style.display = 'none';
    contextNodesCache = {};
}

// ── Session Management ──────────────────────────────────────────

export async function loadSession(sessionId) {
    try {
        var msgs = await api.getChatMessages(sessionId);
        chatMessages = msgs.map(function (m) { return { role: m.role, content: m.content }; });
        set('currentSessionId', sessionId);

        // Load context selections from session
        var sessions = get('chatSessions');
        var session = sessions.find(function (s) { return s.id === sessionId; });
        if (session && session.context_json) {
            try {
                var ctx = JSON.parse(session.context_json);
                set('chatContextSelections', ctx);
            } catch (e) {
                set('chatContextSelections', { folderIds: [], projectIds: [], nodeIds: [] });
            }
        }

        updateChatContextBadge();
        renderChatMessages();
    } catch (e) {
        showError('Failed to load session: ' + String(e));
    }
}

export async function newChatSession() {
    chatMessages = [];
    set('currentSessionId', null);
    var cp = get('currentProject');
    if (cp) {
        set('chatContextSelections', { folderIds: [], projectIds: [cp.id], nodeIds: [] });
    } else {
        set('chatContextSelections', { folderIds: [], projectIds: [], nodeIds: [] });
    }
    updateChatContextBadge();
    renderChatMessages();
    openChat();
}

export function chatWithProject() {
    var cp = get('currentProject');
    if (!cp) return;
    set('chatContextSelections', { folderIds: [], projectIds: [cp.id], nodeIds: [] });
    updateChatContextBadge();
    openChat();
    document.getElementById('chatInput').focus();
}

export function chatWithNode(idx) {
    var currentNodes = get('currentNodes');
    var node = currentNodes[idx];
    var cp = get('currentProject');
    if (!node) return;
    set('chatContextSelections', { folderIds: [], projectIds: cp ? [cp.id] : [], nodeIds: node.id ? [node.id] : [] });
    updateChatContextBadge();
    openChat();
    document.getElementById('chatInput').focus();
}

async function ensureSession(title) {
    var sessionId = get('currentSessionId');
    if (sessionId) return sessionId;

    var sel = get('chatContextSelections');
    var contextJson = JSON.stringify(sel);
    try {
        var session = await api.createChatSession(title, get('selectedApiConfigId'), contextJson);
        var sessions = get('chatSessions');
        set('chatSessions', [session].concat(sessions));
        set('currentSessionId', session.id);
        return session.id;
    } catch (e) {
        showError('Failed to create session: ' + String(e));
        throw e;
    }
}

async function saveMessageToDb(role, content) {
    var sessionId = get('currentSessionId');
    if (!sessionId) return;
    try {
        await api.addChatMessage(sessionId, role, content);
    } catch (e) { /* non-critical */ }
}

// ── Chat Messages ───────────────────────────────────────────────

function renderChatMessages(isStreaming) {
    const container = document.getElementById('chatMessages');
    const empty = document.getElementById('chatEmpty');

    if (chatMessages.length === 0) {
        container.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    container.style.display = 'flex';

    let html = '';
    for (let i = 0; i < chatMessages.length; i++) {
        const msg = chatMessages[i];
        if (msg.role === 'assistant') {
            html += '<div class="chat-msg assistant">';
            html += '<div class="msg-label">AI</div>';
            html += '<div class="bubble">' + (isStreaming && i === chatMessages.length - 1 ? '' : formatChatContent(msg.content)) + '</div>';
            html += '</div>';
        } else if (msg.role === 'user') {
            html += '<div class="chat-msg user">';
            html += '<div class="msg-label">You</div>';
            html += '<div class="bubble">' + escapeHtml(msg.content) + '</div>';
            html += '</div>';
        }
    }
    if (isStreaming) {
        html += '<div class="chat-msg assistant" id="streamingMsg"><div class="msg-label">AI</div><div class="bubble" id="streamingBubble"></div></div>';
    }
    if (chatLoading && !isStreaming) {
        html += '<div class="chat-loading"><div class="dots"><span></span><span></span><span></span></div></div>';
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function formatChatContent(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/^[\t ]*- (.+)$/gm, '<li>$1</li>');
    const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/g);
    for (let i = 0; i < parts.length; i++) {
        if (!parts[i].startsWith('<pre>')) {
            parts[i] = parts[i].replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        }
    }
    return '<p>' + parts.join('') + '</p>';
}

export async function sendChatMessage() {
    if (chatLoading) return;
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    const configs = get('apiConfigs');
    const selectedId = get('selectedApiConfigId');
    if (!selectedId && configs.length > 0) {
        set('selectedApiConfigId', configs[0].id);
        updateModelSelector();
    }
    const activeId = get('selectedApiConfigId');
    const config = configs.find(function (c) { return c.id === activeId; });
    if (!config) {
        showError('Please add an API configuration in Settings first');
        return;
    }

    // Ensure session exists
    try {
        var title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
        await ensureSession(title);
    } catch (e) {
        return;
    }

    // Build context from selections + attachments
    var contextText = '';
    try {
        contextText = await buildFullContext();
    } catch (e) { /* ignore */ }
    if (chatAttachments.length > 0) {
        contextText += '\n\n=== ATTACHED FILES ===\n';
        chatAttachments.forEach(function (f, i) {
            contextText += (i + 1) + '. ' + f.name + ' (' + f.type + ', ' + formatSize(f.size) + ')\n';
        });
    }

    chatMessages.push({ role: 'user', content: text });
    saveMessageToDb('user', text);
    input.value = '';
    input.style.height = 'auto';
    chatLoading = true;
    setSendButtonState(true);

    renderChatMessages(true);
    const bubble = document.getElementById('streamingBubble');
    let streamedContent = '';
    let streamCancelled = false;

    try {
        const unlistenChunk = await window.__TAURI__.event.listen('ai-chunk', function (event) {
            streamedContent += event.payload.content;
            if (bubble) {
                bubble.innerHTML = formatChatContent(streamedContent);
                const container = document.getElementById('chatMessages');
                container.scrollTop = container.scrollHeight;
            }
        });

        const unlistenDone = await window.__TAURI__.event.listen('ai-done', function (event) {
            unlistenChunk();
            unlistenDone();
            currentStreamUnlisten = null;

            document.getElementById('streamingMsg')?.remove();
            if (event.payload.error && event.payload.error === 'cancelled') {
                streamCancelled = true;
                // Save partial content
                if (streamedContent.trim()) {
                    chatMessages.push({ role: 'assistant', content: streamedContent + '\n\n[Stopped]' });
                    saveMessageToDb('assistant', streamedContent + '\n\n[Stopped]');
                }
            } else {
                chatMessages.push({ role: 'assistant', content: streamedContent });
                saveMessageToDb('assistant', streamedContent);
            }
            chatLoading = false;
            setSendButtonState(false);
            renderChatMessages(false);
            document.getElementById('chatInput').focus();
        });

        currentStreamUnlisten = function () {
            unlistenChunk();
            unlistenDone();
            currentStreamUnlisten = null;
        };

        const apiMessages = [];
        let systemContent = config.system_prompt || 'You are a helpful assistant.';
        if (contextText) {
            systemContent += '\n\n' + contextText;
            systemContent += '\n\nUse this context to answer the user questions. Be specific and reference the actual data when possible.';
        }
        apiMessages.push({ role: 'system', content: systemContent });

        const historyStart = Math.max(0, chatMessages.length - 21);
        for (let i = historyStart; i < chatMessages.length; i++) {
            apiMessages.push(chatMessages[i]);
        }

        await api.callAiStream(config.api_key, config.base_url, config.model, JSON.stringify(apiMessages));
    } catch (e) {
        document.getElementById('streamingMsg')?.remove();
        chatMessages.push({ role: 'assistant', content: 'Error: ' + String(e) });
        saveMessageToDb('assistant', 'Error: ' + String(e));
        chatLoading = false;
        setSendButtonState(false);
        currentStreamUnlisten = null;
        renderChatMessages(false);
    }
}

export function stopChatMessage() {
    if (!chatLoading) return;
    // Cancel the backend stream
    api.cancelAiStream().catch(function () { /* ignore */ });
    // Clean up listeners
    if (currentStreamUnlisten) {
        currentStreamUnlisten();
        currentStreamUnlisten = null;
    }
    // Grab the streamed content before removing the DOM element
    var bubble = document.getElementById('streamingBubble');
    var partialContent = bubble ? bubble.innerText : '';
    document.getElementById('streamingMsg')?.remove();
    if (partialContent.trim()) {
        chatMessages.push({ role: 'assistant', content: partialContent + '\n\n[Stopped]' });
        saveMessageToDb('assistant', partialContent + '\n\n[Stopped]');
    }
    chatLoading = false;
    setSendButtonState(false);
    renderChatMessages(false);
}

function setSendButtonState(loading) {
    var btn = document.getElementById('chatSendBtn');
    if (!btn) return;
    if (loading) {
        btn.innerHTML = '&#9632;';
        btn.title = 'Stop';
        btn.onclick = stopChatMessage;
        btn.classList.add('chat-send-stop');
    } else {
        btn.innerHTML = '&#8593;';
        btn.title = 'Send';
        btn.onclick = sendChatMessage;
        btn.classList.remove('chat-send-stop');
    }
}

export function handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        sendChatMessage();
    }
}

// ── Chat Menu (Attachments + Model) ──────────────────────────────

let chatAttachments = [];

export function toggleChatMenu() {
    var menu = document.getElementById('chatMenu');
    if (!menu) return;
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        renderModelList();
        renderChatAttachments();
        menu.style.display = 'block';
    }
}

function closeChatMenu() {
    var menu = document.getElementById('chatMenu');
    if (menu) menu.style.display = 'none';
}

export function handleChatFileSelect(e) {
    var files = Array.from(e.target.files);
    files.forEach(function (file) {
        var reader = new FileReader();
        reader.onload = function () {
            chatAttachments.push({
                name: file.name,
                size: file.size,
                type: file.type,
                data: reader.result
            });
            renderChatAttachments();
        };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
}

function removeChatAttachment(idx) {
    chatAttachments.splice(idx, 1);
    renderChatAttachments();
}

function renderChatAttachments() {
    var container = document.getElementById('chatAttachments');
    if (!container) return;
    if (chatAttachments.length === 0) {
        container.innerHTML = '<div class="chat-attachment-empty">No attachments</div>';
    } else {
        container.innerHTML = chatAttachments.map(function (f, i) {
            return '<div class="chat-attachment-item"><span class="chat-attachment-name">' + escapeHtml(f.name) + '</span><span class="chat-attachment-remove" data-idx="' + i + '">&times;</span></div>';
        }).join('');
        container.querySelectorAll('.chat-attachment-remove').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                removeChatAttachment(parseInt(el.dataset.idx));
            });
        });
    }
}

export function renderModelList() {
    var container = document.getElementById('chatModelList');
    if (!container) return;
    var configs = get('apiConfigs');
    var selectedId = get('selectedApiConfigId');

    if (configs.length === 0) {
        container.innerHTML = '<div class="chat-model-empty">No API configs — add one in Settings first</div>';
        return;
    }

    container.innerHTML = configs.map(function (c) {
        var isActive = c.id === selectedId;
        return '<div class="chat-model-item' + (isActive ? ' active' : '') + '" data-id="' + c.id + '"><span class="chat-model-name">' + escapeHtml(c.name) + '</span><span class="chat-model-id">' + escapeHtml(c.model) + '</span></div>';
    }).join('');

    container.querySelectorAll('.chat-model-item').forEach(function (el) {
        el.addEventListener('click', function () {
            var id = parseInt(el.dataset.id);
            set('selectedApiConfigId', id);
            renderModelList();
        });
    });
}

export function selectChatModel(configId) {
    set('selectedApiConfigId', configId);
    renderModelList();
}

// Initialize model selector on load — shows current model in the menu
export function updateModelSelector() {
    var configs = get('apiConfigs');
    var selectedId = get('selectedApiConfigId');
    if (!selectedId && configs.length > 0) {
        set('selectedApiConfigId', configs[0].id);
    }
    renderModelList();
}

export function handleModelSelectChange() {
    // Kept for backwards compat — no-op, model selection is now in the menu
}

// Close chat menu when clicking outside
document.addEventListener('click', function (e) {
    var menu = document.getElementById('chatMenu');
    var btn = document.getElementById('chatMenuBtn');
    if (menu && menu.style.display === 'block') {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.style.display = 'none';
        }
    }
});

// Bind chat menu file button
document.getElementById('chatAddFileBtn')?.addEventListener('click', function () {
    document.getElementById('chatFileInput').click();
});
document.getElementById('chatFileInput')?.addEventListener('change', function (e) {
    handleChatFileSelect(e);
});

// ── Expose for inline onclick ───────────────────────────────────

window._toggleContextPicker = toggleContextPicker;
window._closeContextPicker = closeContextPicker;
window.toggleChatMenu = toggleChatMenu;
window.handleChatFileSelect = handleChatFileSelect;
window.stopChatMessage = stopChatMessage;
