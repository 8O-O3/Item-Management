// ── Sidebar — unified folder + project tree ──────────────────

import { get, set } from './store.js';
import { fetchNodes, fetchFolders, fetchProjects, createFolder, createProject, moveFolder, moveProject, deleteProject as apiDeleteProject, updateChatSession as apiUpdateChatSession } from './api.js';
import { escapeHtml, showError, bindTextTooltips } from './utils.js';
import { deleteFolder, showConfirm } from './modals.js';
import { renderBoard } from './board.js';
import { renderSettings } from './settings.js';
import { loadSession, newChatSession } from './chat.js';
import { deleteChatSession as apiDeleteChatSession } from './api.js';

// ── Inline input state ─────────────────────────────────────────
// { type: 'folder' | 'project', parentId: number | null }

let inlineInput = null;
let chatSessionRenameId = null;

function startInlineInput(type, parentId) {
    inlineInput = { type, parentId };
    renderSidebar();
    // Focus after render
    requestAnimationFrame(() => {
        const inp = document.getElementById('inlineTreeInput');
        if (inp) inp.focus();
    });
}

function cancelInlineInput() {
    inlineInput = null;
    renderSidebar();
}

async function confirmInlineInput() {
    const inp = document.getElementById('inlineTreeInput');
    if (!inp) return;
    const name = inp.value.trim();
    if (!name) return;

    try {
        if (inlineInput.type === 'folder') {
            const folder = await createFolder(name, inlineInput.parentId);
            const folders = [...get('folders'), folder];
            set('folders', folders);
        } else {
            const project = await createProject(name, null, inlineInput.parentId);
            const projects = [...get('projects'), project];
            set('projects', projects);
        }
    } catch (e) {
        showError(String(e));
    }

    inlineInput = null;
    renderSidebar();
}

// ── Tree ───────────────────────────────────────────────────────

export function toggleFolderExpand(id) {
    const expanded = get('expandedFolders');
    const next = new Set(expanded);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    set('expandedFolders', next);
    renderSidebar();
}

function renderInlineInput(indent) {
    const label = inlineInput.type === 'folder' ? 'Folder name' : 'Project name';
    return `<div class="tree-row tree-input-row" style="padding-left:${indent}px;">
        <span class="tree-toggle" style="visibility:hidden;"> </span>
        <span class="tree-icon">${inlineInput.type === 'folder' ? '&#128193;' : '&#128196;'}</span>
        <input type="text" class="tree-inline-input" id="inlineTreeInput"
            placeholder="${label}" autocomplete="off"
            onkeydown="window._handleInlineKey(event)" onblur="window._handleInlineBlur()">
    </div>`;
}

function renderTree(folders, projects, parentId = null, depth = 1) {
    const childFolders = folders.filter(f => f.parent_id === parentId);
    const childProjects = projects.filter(p => p.folder_id === parentId);

    const expanded = get('expandedFolders');
    const currentFolder = get('currentFolder');
    const currentProject = get('currentProject');
    const indent = depth * 16;

    let html = '';

    // Inline input for this level
    if (inlineInput && inlineInput.parentId === parentId) {
        html += renderInlineInput(indent);
    }

    if (childFolders.length === 0 && childProjects.length === 0) return html;

    // Sort: first folders by name, then projects by name
    const items = [
        ...childFolders.map(f => ({ type: 'folder', data: f })),
        ...childProjects.map(p => ({ type: 'project', data: p })),
    ].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.data.name.localeCompare(b.data.name);
    });

    for (const item of items) {
        if (item.type === 'folder') {
            const f = item.data;
            const hasChildren = folders.some(c => c.parent_id === f.id)
                || projects.some(p => p.folder_id === f.id);
            const isExpanded = expanded.has(f.id);
            const isSelected = currentFolder === f.id && !currentProject;

            html += `<div class="tree-row tree-folder ${isSelected ? 'active' : ''}" style="padding-left:${indent}px;" data-action="select-folder" data-id="${f.id}" data-drag-type="folder" data-drag-id="${f.id}" data-menu-type="folder" data-menu-id="${f.id}" data-menu-depth="${depth}">`;
            html += `<span class="tree-toggle" data-action="toggle-folder" data-id="${f.id}">${hasChildren ? (isExpanded ? 'v' : '>') : ' '}</span>`;
            html += `<span class="tree-icon">&#128193;</span>`;
            html += `<span class="tree-name">${escapeHtml(f.name)}</span>`;
            html += `<span class="tree-actions">`;
            html += `<button class="btn-icon btn-icon-menu" data-action="context-menu" data-menu-type="folder" data-menu-id="${f.id}" data-menu-depth="${depth}" title="More actions">…</button>`;
            html += `</span></div>`;

            if ((hasChildren || (inlineInput && inlineInput.parentId === f.id)) && isExpanded) {
                html += renderTree(folders, projects, f.id, depth + 1);
            }
        } else {
            const p = item.data;
            const isSelected = currentProject && currentProject.id === p.id;

            html += `<div class="tree-row tree-project ${isSelected ? 'active' : ''}" style="padding-left:${indent}px;" data-action="select-project" data-id="${p.id}" data-drag-type="project" data-drag-id="${p.id}" data-menu-type="project" data-menu-id="${p.id}">`;
            html += `<span class="tree-toggle" style="visibility:hidden;"> </span>`;
            html += `<span class="tree-icon">&#128196;</span>`;
            html += `<span class="tree-name">${escapeHtml(p.name)}</span>`;
            html += `<span class="tree-actions">`;
            html += `<button class="btn-icon btn-icon-menu" data-action="context-menu" data-menu-type="project" data-menu-id="${p.id}" title="More actions">…</button>`;
            html += `</span></div>`;
        }
    }

    return html;
}

// ── Render ──────────────────────────────────────────────────────

export function renderSidebar() {
    const mode = get('sidebarMode');
    const content = document.getElementById('sidebarContent');
    if (!content) return;

    if (mode === 'settings') {
        renderSettings();
    } else {
        renderTreeView();
    }
}

function renderTreeView() {
    const folders = get('folders');
    const projects = get('projects');
    const currentFolder = get('currentFolder');
    const currentProject = get('currentProject');

    const content = document.getElementById('sidebarContent');
    if (!content) return;

    content.innerHTML = `
        <div class="sidebar-section">
            <div class="sidebar-title">Explorer</div>
            <div id="treeList">
                <div class="tree-row tree-root ${currentFolder === null && !currentProject ? 'active' : ''}" data-action="select-folder" data-id="" data-menu-type="root">
                    <span class="tree-toggle" style="visibility:hidden;"> </span>
                    <span class="tree-icon">&#127968;</span>
                    <span class="tree-name">All</span>
                    <span class="tree-actions">
                        <button class="btn-icon btn-icon-menu" data-action="context-menu" data-menu-type="root" title="More actions">…</button>
                    </span>
                </div>
                ${inlineInput && inlineInput.parentId === null ? renderInlineInput(16) : ''}
                ${renderTree(folders, projects)}
            </div>
            <div class="add-btn-row">
                <div class="add-btn" id="addFolderBtn">+ New Folder</div>
                <div class="add-btn" id="addProjectBtn">+ New Project</div>
            </div>
        </div>
        ${renderChatSessions()}
    `;

    // Bind add-button events
    var addFolderBtn = document.getElementById('addFolderBtn');
    if (addFolderBtn) addFolderBtn.addEventListener('click', function () { import('./modals.js').then(function (m) { m.openFolderModal(); }); });
    var addProjectBtn = document.getElementById('addProjectBtn');
    if (addProjectBtn) addProjectBtn.addEventListener('click', function () { import('./modals.js').then(function (m) { m.openProjectModal(); }); });

    bindTreeEvents();
    bindDragEvents();
    bindChatSessionEvents();
}

// ── Chat Sessions Sidebar Section ──────────────────────────────

function renderChatSessions() {
    var sessions = get('chatSessions');
    var currentId = get('currentSessionId');

    var html = '<div class="sidebar-section"><div class="sidebar-title">Chats</div>';
    html += '<div id="chatSessionList">';
    if (sessions.length === 0) {
        html += '<div class="sidebar-session-empty">No chats yet</div>';
    } else {
        sessions.forEach(function (s) {
            var active = s.id === currentId ? ' active' : '';
            var isRenaming = s.id === chatSessionRenameId;
            html += '<div class="sidebar-session-item' + active + '" data-session-id="' + s.id + '" data-menu-type="chat-session" data-menu-id="' + s.id + '">';
            if (isRenaming) {
                html += '<input type="text" class="sidebar-session-rename-input" id="chatSessionRenameInput" value="' + escapeHtml(s.title) + '" autocomplete="off">';
            } else {
                html += '<span class="sidebar-session-title">' + escapeHtml(s.title) + '</span>';
                html += '<button class="btn-icon btn-icon-menu sidebar-session-menu" data-action="chat-context-menu" data-session-id="' + s.id + '" title="More actions">…</button>';
            }
            html += '</div>';
        });
    }
    html += '</div>';
    html += '<div class="add-btn-row"><div class="add-btn" id="newChatBtn">+ New Chat</div></div>';
    html += '</div>';
    return html;
}

function startChatSessionRename(id) {
    chatSessionRenameId = id;
    renderSidebar();
}

async function confirmChatSessionRename() {
    var input = document.getElementById('chatSessionRenameInput');
    if (!input) return;
    var newTitle = input.value.trim();
    if (!newTitle || newTitle === '') {
        cancelChatSessionRename();
        return;
    }
    var id = chatSessionRenameId;
    chatSessionRenameId = null;
    try {
        var sessions = get('chatSessions');
        var session = sessions.find(function (s) { return s.id === id; });
        var modelConfigId = session ? session.model_config_id : null;
        var contextJson = session ? session.context_json : null;
        await apiUpdateChatSession(id, newTitle, modelConfigId, contextJson);
        var updated = sessions.map(function (s) {
            if (s.id === id) { return Object.assign({}, s, { title: newTitle }); }
            return s;
        });
        set('chatSessions', updated);
    } catch (e) {
        showError(String(e));
    }
    renderSidebar();
}

function cancelChatSessionRename() {
    chatSessionRenameId = null;
    renderSidebar();
}

async function deleteChatSessionFromSidebar(id) {
    var sessions = get('chatSessions');
    var name = (sessions.find(function (s) { return s.id === id; }) || {}).title || 'this chat';
    var confirmed = await showConfirm('Delete "' + name + '"?');
    if (!confirmed) return;
    try {
        await apiDeleteChatSession(id);
        var remaining = sessions.filter(function (s) { return s.id !== id; });
        set('chatSessions', remaining);
        if (get('currentSessionId') === id) {
            set('currentSessionId', null);
            var { clearChat } = await import('./chat.js');
            clearChat();
        }
        renderSidebar();
    } catch (e) {
        showError(String(e));
    }
}

function bindChatSessionEvents() {
    // Session item click
    document.querySelectorAll('.sidebar-session-item').forEach(function (el) {
        el.addEventListener('click', async function (e) {
            if (e.target.closest('button') || e.target.closest('input')) return;
            var sessionId = parseInt(el.dataset.sessionId);
            await loadSession(sessionId);
            // Navigate to first project in context
            var sessions = get('chatSessions');
            var session = sessions.find(function (s) { return s.id === sessionId; });
            if (session && session.context_json) {
                try {
                    var ctx = JSON.parse(session.context_json);
                    if (ctx.projectIds && ctx.projectIds.length > 0) {
                        await selectProjectById(ctx.projectIds[0]);
                    }
                } catch (e) { /* ignore */ }
            }
            renderSidebar();
            document.getElementById('chatPanel').classList.add('active');
        });
    });

    // "..." context menu button
    document.querySelectorAll('[data-action="chat-context-menu"]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            var id = parseInt(el.dataset.sessionId);
            showContextMenu(getContextMenuItems('chat-session', id), e.clientX, e.clientY);
        });
    });

    // Right-click context menu on chat session items
    document.querySelectorAll('.sidebar-session-item[data-menu-type]').forEach(function (el) {
        el.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var id = parseInt(el.dataset.menuId);
            showContextMenu(getContextMenuItems('chat-session', id), e.clientX, e.clientY);
        });
    });

    // Rename input keyboard handling
    var renameInput = document.getElementById('chatSessionRenameInput');
    if (renameInput) {
        renameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmChatSessionRename();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelChatSessionRename();
            }
        });
        renameInput.addEventListener('blur', function () {
            setTimeout(function () {
                if (chatSessionRenameId !== null) cancelChatSessionRename();
            }, 150);
        });
        renameInput.focus();
        renameInput.select();
    }

    // New chat button
    var newBtn = document.getElementById('newChatBtn');
    if (newBtn) {
        newBtn.addEventListener('click', function () {
            newChatSession();
            renderSidebar();
        });
    }
}

export function toggleSettings() {
    const mode = get('sidebarMode');
    set('sidebarMode', mode === 'settings' ? 'tree' : 'settings');
    renderSidebar();
}

// ── Events ──────────────────────────────────────────────────────

function bindTreeEvents() {
    const treeList = document.getElementById('treeList');
    if (!treeList) return;

    // Select folder
    treeList.querySelectorAll('.tree-row[data-action="select-folder"]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('.tree-toggle[data-action]') || e.target.closest('input')) return;
            const id = el.dataset.id;
            selectFolder(id ? parseInt(id) : null);
        });
    });

    // Select project
    treeList.querySelectorAll('.tree-row[data-action="select-project"]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            selectProjectById(parseInt(el.dataset.id));
        });
    });

    // Toggle expand
    treeList.querySelectorAll('.tree-toggle[data-action="toggle-folder"]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFolderExpand(parseInt(el.dataset.id));
        });
    });

    // Context menu "..." button
    treeList.querySelectorAll('[data-action="context-menu"]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = el.dataset.menuType;
            const id = type !== 'root' ? parseInt(el.dataset.menuId) : null;
            const depth = parseInt(el.dataset.menuDepth) || 0;
            showContextMenu(getContextMenuItems(type, id, depth), e.clientX, e.clientY);
        });
    });

    // Right-click context menu on tree rows
    treeList.querySelectorAll('.tree-row[data-menu-type]').forEach(el => {
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const type = el.dataset.menuType;
            const id = type !== 'root' ? parseInt(el.dataset.menuId) : null;
            const depth = parseInt(el.dataset.menuDepth) || 0;
            showContextMenu(getContextMenuItems(type, id, depth), e.clientX, e.clientY);
        });
    });

    // Tooltips for truncated names
    bindTextTooltips(treeList);
}

// ── Drag & Drop (mouse-based, bypasses WebView HTML5 drag bugs) ─

let dragState = null;      // { type, id, startX, startY, row }
let dragClone = null;      // floating clone element
let dragExpandTimer = null;
let isDragging = false;
const DRAG_THRESHOLD = 5;  // pixels to move before drag starts

function findDragRow(el) {
    const row = el.closest('.tree-row');
    if (!row) return null;
    const type = row.dataset.dragType;
    const id = row.dataset.dragId;
    if (!type || !id) return null;
    return { row, type, id: parseInt(id, 10) };
}

function findDropRow(x, y) {
    // Hide clone temporarily so elementFromPoint sees through it
    if (dragClone) dragClone.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (dragClone) dragClone.style.display = '';
    if (!el) return null;
    return el.closest('.tree-row');
}

function clearDragTarget() {
    document.querySelectorAll('.tree-row.drop-target').forEach(r => r.classList.remove('drop-target'));
    if (dragExpandTimer) { clearTimeout(dragExpandTimer); dragExpandTimer = null; }
}

function cleanupDrag() {
    clearDragTarget();
    if (dragClone) { dragClone.remove(); dragClone = null; }
    if (dragState && dragState.row) dragState.row.classList.remove('dragging');
    document.querySelectorAll('.tree-row.dragging').forEach(r => r.classList.remove('dragging'));
    const treeList = document.getElementById('treeList');
    if (treeList) treeList.classList.remove('is-dragging');
    dragState = null;
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
}

async function finishDrag(targetRow) {
    if (!dragState || !targetRow) return;

    const rowType = targetRow.dataset.dragType;
    const isRoot = targetRow.classList.contains('tree-root');
    let newParentId = null;

    if (rowType === 'folder') {
        newParentId = parseInt(targetRow.dataset.dragId, 10);
    } else if (isRoot) {
        newParentId = null;
    } else if (rowType === 'project') {
        const projects = get('projects');
        const proj = projects.find(p => p.id === parseInt(targetRow.dataset.dragId, 10));
        if (proj) newParentId = proj.folder_id;
    }

    if (dragState.type === 'folder' && dragState.id === newParentId) return;

    const saved = { type: dragState.type, id: dragState.id };
    cleanupDrag();

    try {
        if (saved.type === 'folder') {
            await moveFolder(saved.id, newParentId);
        } else {
            await moveProject(saved.id, newParentId);
        }
        const [folders, projects] = await Promise.all([fetchFolders(), fetchProjects()]);
        set('folders', folders);
        set('projects', projects);
        renderSidebar();
        const cp = get('currentProject');
        if (cp && saved.type === 'project' && saved.id === cp.id) {
            set('currentFolder', newParentId);
        }
    } catch (err) {
        showError(String(err));
    }
}

function onDragMouseDown(e) {
    if (e.button !== 0) return; // left button only
    const info = findDragRow(e.target);
    if (!info) return;
    // Don't start drag if clicking a button or input
    if (e.target.closest('button, input')) return;

    dragState = { ...info, startX: e.clientX, startY: e.clientY, row: info.row };
}

function onDragMouseMove(e) {
    if (!dragState) return;
    e.preventDefault(); // Prevent text selection while dragging

    // Check if moved enough to start dragging
    if (!isDragging) {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        // Start drag
        isDragging = true;
        dragState.row.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        const treeList = document.getElementById('treeList');
        if (treeList) treeList.classList.add('is-dragging');
        // Create floating clone
        dragClone = dragState.row.cloneNode(true);
        dragClone.style.cssText = `
            position: fixed; z-index: 9999; pointer-events: none;
            opacity: 0.85; width: ${dragState.row.offsetWidth}px;
            background: var(--surface, rgba(255,255,255,0.9));
            box-shadow: 0 4px 16px rgba(0,0,0,0.2); border-radius: 6px;
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(dragClone);
    }

    // Move clone
    if (dragClone) {
        dragClone.style.left = e.clientX + 'px';
        dragClone.style.top = e.clientY + 'px';
    }

    // Find and highlight drop target
    clearDragTarget();
    const targetRow = findDropRow(e.clientX, e.clientY);
    if (!targetRow) return;

    const rowType = targetRow.dataset.dragType;
    const isRoot = targetRow.classList.contains('tree-root');
    if (rowType !== 'folder' && !isRoot) return;

    const targetId = rowType === 'folder' ? parseInt(targetRow.dataset.dragId, 10) : null;
    if (dragState.type === 'folder' && dragState.id === targetId) return;

    targetRow.classList.add('drop-target');

    // Auto-expand after 0.8s hover
    if (rowType === 'folder' && targetId != null) {
        const expanded = get('expandedFolders');
        if (!expanded.has(targetId)) {
            if (!dragExpandTimer) {
                dragExpandTimer = setTimeout(() => {
                    const exp = new Set(get('expandedFolders'));
                    exp.add(targetId);
                    set('expandedFolders', exp);
                    renderSidebar();
                    // Restore drag state after re-render
                    if (dragClone) dragClone.style.display = '';
                }, 800);
            }
        }
    }
}

function onDragMouseUp(e) {
    if (!dragState || !isDragging) {
        // Clean up mousedown state if we never started a drag
        dragState = null;
        return;
    }

    const targetRow = findDropRow(e.clientX, e.clientY);
    if (targetRow) {
        finishDrag(targetRow);
    } else {
        cleanupDrag();
    }
}

let _dragDocReady = false;

function bindDragEvents() {
    const treeList = document.getElementById('treeList');
    if (!treeList) return;

    treeList.querySelectorAll('[data-drag-type]').forEach(row => {
        row.addEventListener('mousedown', onDragMouseDown);
    });

    // One-time document-level setup
    if (!_dragDocReady) {
        _dragDocReady = true;
        document.addEventListener('mousemove', onDragMouseMove);
        document.addEventListener('mouseup', onDragMouseUp);
    }
}

// ── Inline input keyboard handlers (global) ───────────────────

window._handleInlineKey = function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        confirmInlineInput();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelInlineInput();
    }
};

window._handleInlineBlur = function () {
    // Small delay so Enter/Escape click handlers fire first
    setTimeout(() => {
        if (inlineInput) cancelInlineInput();
    }, 150);
};

// ── Context Menu ──────────────────────────────────────────────────

let contextMenuEl = null;

function ensureContextMenu() {
    if (!contextMenuEl) {
        contextMenuEl = document.createElement('div');
        contextMenuEl.className = 'context-menu';
        document.body.appendChild(contextMenuEl);
        document.addEventListener('click', hideContextMenu, true);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hideContextMenu();
        });
    }
    return contextMenuEl;
}

function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.classList.remove('active');
}

function showContextMenu(items, x, y) {
    var menu = ensureContextMenu();

    var html = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.separator) {
            html += '<div class="context-menu-divider"></div>';
        } else {
            html += '<button class="context-menu-item' + (item.danger ? ' danger' : '') + '">' + escapeHtml(item.label) + '</button>';
        }
    }
    menu.innerHTML = html;

    // Bind click handlers
    var btns = menu.querySelectorAll('.context-menu-item');
    var idx = 0;
    btns.forEach(function (btn) {
        while (idx < items.length && items[idx].separator) idx++;
        if (idx >= items.length) return;
        var item = items[idx++];
        btn.addEventListener('click', function () {
            hideContextMenu();
            item.action();
        });
    });

    // Position — keep within viewport
    menu.classList.add('active');
    var mw = menu.offsetWidth;
    var mh = menu.offsetHeight;
    var left = x;
    var top = y;
    if (left + mw > window.innerWidth) left = window.innerWidth - mw - 8;
    if (top + mh > window.innerHeight) top = window.innerHeight - mh - 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

function getContextMenuItems(type, id, depth) {
    var items = [];
    if (type === 'root') {
        items.push({ label: 'New Folder', action: function () { startInlineInput('folder', null); } });
        items.push({ label: 'New Project', action: function () { startInlineInput('project', null); } });
    } else if (type === 'folder') {
        if (depth < 4) {
            items.push({ label: 'New Sub-folder', action: function () {
                var expanded = new Set(get('expandedFolders'));
                expanded.add(id);
                set('expandedFolders', expanded);
                startInlineInput('folder', id);
            }});
        }
        items.push({ label: 'New Project Here', action: function () {
            var expanded = new Set(get('expandedFolders'));
            expanded.add(id);
            set('expandedFolders', expanded);
            startInlineInput('project', id);
        }});
        items.push({ separator: true });
        items.push({ label: 'Rename', action: function () { import('./modals.js').then(function (m) { m.openFolderModal(id); }); } });
        items.push({ label: 'Delete', danger: true, action: function () { deleteFolder(id); } });
    } else if (type === 'project') {
        items.push({ label: 'Rename', action: function () { import('./modals.js').then(function (m) { m.openProjectModal(id); }); } });
        items.push({ label: 'Delete', danger: true, action: function () { deleteProjectFromSidebar(id); } });
    } else if (type === 'chat-session') {
        items.push({ label: 'Rename', action: function () { startChatSessionRename(id); } });
        items.push({ label: 'Delete', danger: true, action: function () { deleteChatSessionFromSidebar(id); } });
    }
    return items;
}

async function deleteProjectFromSidebar(id) {
    var projects = get('projects');
    var name = (projects.find(function (p) { return p.id === id; }) || {}).name || 'this project';
    var confirmed = await showConfirm('Delete "' + name + '" and all its nodes?');
    if (!confirmed) return;
    try {
        await apiDeleteProject(id);
        var projects = get('projects').filter(function (p) { return p.id !== id; });
        set('projects', projects);
        var cp = get('currentProject');
        if (cp && cp.id === id) {
            set('currentProject', null);
            set('currentNodes', []);
            set('expandedNodes', new Set());
            renderBoard();
        }
        renderSidebar();
    } catch (e) {
        showError(String(e));
    }
}

// ── Actions ─────────────────────────────────────────────────────

export async function selectFolder(id) {
    inlineInput = null;
    if (id !== null) {
        const folders = get('folders');
        const expanded = new Set(get('expandedFolders'));
        let current = id;
        while (current) {
            const f = folders.find(x => x.id === current);
            if (f && f.parent_id) {
                expanded.add(f.parent_id);
                current = f.parent_id;
            } else {
                break;
            }
        }
        set('expandedFolders', expanded);
    }
    set('currentFolder', id);
    set('currentProject', null);
    set('currentNodes', []);
    set('expandedNodes', new Set());
    renderSidebar();
    renderBoard();
}

export async function selectProjectById(id) {
    inlineInput = null;
    const projects = get('projects');
    const p = projects.find(x => x.id === id);
    if (p) await selectProject(p);
}

export async function selectProject(p) {
    set('currentFolder', p.folder_id);
    set('currentProject', p);
    set('expandedNodes', new Set());

    if (p && p.id) {
        try {
            const nodes = await fetchNodes(p.id);
            set('currentNodes', nodes);
        } catch (e) {
            showError('Failed to load nodes: ' + e);
            set('currentNodes', []);
        }
    } else {
        set('currentNodes', []);
    }
    renderSidebar();
    renderBoard();
}
