// ── Board — main content area (nodes, files, timeline) ─────────

import { get, set } from './store.js';
import { fetchNodes, deleteProject as apiDeleteProject, deleteNode as apiDeleteNode, addTimelineEntry as apiAddTimeline, search as apiSearch } from './api.js';
import { escapeHtml, formatTime, showError, bindTextTooltips } from './utils.js';
import { openNodeModal, openFileModal, showConfirm } from './modals.js';
import { previewFile } from './preview.js';
import { chatWithProject, chatWithNode } from './chat.js';
import { renderSidebar } from './sidebar.js';

export function renderBoard() {
    const main = document.getElementById('main');
    const currentProject = get('currentProject');
    const currentNodes = get('currentNodes');
    const expandedNodes = get('expandedNodes');
    const folders = get('folders');

    if (!currentProject) {
        main.innerHTML = `<div class="empty-state"><div class="icon">[ ]</div><h3>Select or create a project</h3><p>Choose a folder from the left sidebar or create a new project to get started</p></div>`;
        return;
    }

    const folder = folders.find(f => f.id === currentProject.folder_id);

    main.innerHTML = `
        <div class="main-header">
            <div>
                <div class="main-title">${escapeHtml(currentProject.name)}</div>
                ${currentProject.desc ? `<div class="main-subtitle">${escapeHtml(currentProject.desc)}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;">
                <button class="btn" data-variant="ghost" id="chatProjectBtn">Chat about Project</button>
                <button class="btn" id="deleteProjectBtn">Delete</button>
            </div>
        </div>

        <div class="breadcrumb">
            <a href="#" id="breadcrumbAll">All</a>
            ${folder ? `<span>/</span><span>${escapeHtml(folder.name)}</span>` : ''}
            <span>/</span>
            <span>${escapeHtml(currentProject.name)}</span>
        </div>

        ${currentNodes.length === 0 ? `
            <div style="text-align:center;padding:80px;color:var(--text-secondary);">
                <div style="font-size:56px;margin-bottom:20px;opacity:0.3;font-family:serif;">[...]</div>
                <div style="font-size:18px;font-weight:500;color:var(--text);margin-bottom:10px;">No nodes yet</div>
                <div style="font-size:14px;">Click the button below to add the first node</div>
            </div>
        ` : `
            <div class="nodes-list">
                ${currentNodes.map((node, idx) => {
                    const isExpanded = expandedNodes.has(idx);
                    return `
                        <div class="node-card ${isExpanded ? 'expanded' : 'collapsed'}">
                            <div class="node-header" data-action="toggle-node" data-idx="${idx}">
                                <div class="node-expand-icon">${isExpanded ? '<' : '>'}</div>
                                <div class="node-info">
                                    <div class="node-title">${escapeHtml(node.title)}</div>
                                    ${node.desc && !isExpanded ? `<div class="node-desc-preview">${escapeHtml(node.desc)}</div>` : ''}
                                </div>
                                <div class="node-meta">
                                    <span class="node-file-count">[F] ${(node.files || []).length}</span>
                                    <span class="node-timeline-count">[T] ${(node.timeline || []).length}</span>
                                    <button class="btn node-delete-btn" data-variant="ghost-danger" data-action="delete-node" data-idx="${idx}">Delete</button>
                                </div>
                            </div>
                            ${isExpanded ? `
                                <div class="node-body">
                                    ${node.desc ? `<div style="font-size:14px;color:var(--text-secondary);margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border);">${escapeHtml(node.desc)}</div>` : ''}
                                    <div style="display:flex;gap:8px;margin-bottom:20px;">
                                        <button class="btn" data-variant="ghost" data-action="chat-node" data-idx="${idx}" style="font-size:12px;">Chat about Node</button>
                                        <button class="btn" data-variant="ghost" data-action="edit-node" data-idx="${idx}" style="font-size:12px;">Edit Node</button>
                                    </div>
                                    <div class="node-section">
                                        <div class="node-section-label">Attachments</div>
                                        <div class="files-grid">
                                            ${(node.files || []).map((f, fi) => `
                                                <div class="file-chip">
                                                    <span class="file-name" data-action="preview-file" data-node-idx="${idx}" data-file-idx="${fi}" title="Preview">${escapeHtml(f.name)}</span>
                                                    <span class="file-dl" data-action="download-file" data-node-idx="${idx}" data-file-idx="${fi}" title="Download">&#8595;</span>
                                                    <span class="remove" data-action="delete-file" data-node-idx="${idx}" data-file-idx="${fi}">x</span>
                                                </div>
                                            `).join('')}
                                            <div class="file-chip add-file-chip" data-action="add-file" data-node-idx="${idx}">+ Add</div>
                                        </div>
                                    </div>
                                    <div class="node-section">
                                        <div class="node-section-label">Timeline</div>
                                        <div class="timeline-list">
                                            ${(node.timeline || []).map(t => `
                                                <div class="timeline-item">
                                                    <span class="content">${escapeHtml(t.content)}</span>
                                                    <span class="time">${formatTime(t.time)}</span>
                                                </div>
                                            `).join('')}
                                            ${(node.timeline || []).length === 0 ? '<div style="color:var(--text-secondary);font-size:13px;padding:10px 0;">No records</div>' : ''}
                                        </div>
                                        <div class="timeline-input-wrap">
                                            <input type="text" placeholder="Add a note..." data-tl-idx="${idx}" data-action="timeline-input">
                                            <button data-action="add-timeline" data-idx="${idx}">Add</button>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `}

        <div class="add-node-btn" id="addNodeBtn">+ Add Node</div>
    `;

    // Bind events
    bindBoardEvents();
}

function bindBoardEvents() {
    const main = document.getElementById('main');

    // Chat about Project
    const chatProjBtn = document.getElementById('chatProjectBtn');
    if (chatProjBtn) chatProjBtn.addEventListener('click', () => chatWithProject());

    // Delete Project
    const delProjBtn = document.getElementById('deleteProjectBtn');
    if (delProjBtn) delProjBtn.addEventListener('click', () => deleteCurrentProject());

    // Breadcrumb "All" link
    const bcAll = document.getElementById('breadcrumbAll');
    if (bcAll) {
        bcAll.addEventListener('click', (e) => {
            e.preventDefault();
            import('./sidebar.js').then(m => m.selectFolder(null));
        });
    }

    // Add Node button
    const addBtn = document.getElementById('addNodeBtn');
    if (addBtn) addBtn.addEventListener('click', () => openNodeModal(null));

    // Delegate click events for node cards
    main.querySelectorAll('[data-action]').forEach(el => {
        const action = el.dataset.action;
        const idx = parseInt(el.dataset.idx);
        const nodeIdx = parseInt(el.dataset.nodeIdx);
        const fileIdx = parseInt(el.dataset.fileIdx);
        const tlIdx = parseInt(el.dataset.tlIdx);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            switch (action) {
                case 'toggle-node':
                    toggleNode(idx);
                    break;
                case 'delete-node':
                    deleteNodeByIndex(idx);
                    break;
                case 'edit-node':
                    openNodeModal(idx);
                    break;
                case 'chat-node':
                    chatWithNode(idx);
                    break;
                case 'preview-file':
                    previewFile(nodeIdx, fileIdx);
                    break;
                case 'download-file':
                    import('./preview.js').then(m => m.downloadFile(nodeIdx, fileIdx));
                    break;
                case 'delete-file':
                    import('./modals.js').then(m => m.removeExistingFileDirect(nodeIdx, fileIdx));
                    break;
                case 'add-file':
                    openFileModal(idx);
                    break;
                case 'add-timeline':
                    addTimeline(idx);
                    break;
            }
        });
    });

    // Timeline input Enter key
    main.querySelectorAll('[data-tl-idx]').forEach(input => {
        const idx = parseInt(input.dataset.tlIdx);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                addTimeline(idx);
            }
        });
    });

    // Tooltips for truncated file names
    bindTextTooltips(main);
}

export function toggleNode(idx) {
    const expandedNodes = get('expandedNodes');
    const newSet = new Set(expandedNodes);

    if (newSet.has(idx)) {
        newSet.delete(idx);
    } else {
        if (newSet.size >= 3) {
            const oldest = newSet.values().next().value;
            newSet.delete(oldest);
        }
        newSet.add(idx);
    }

    set('expandedNodes', newSet);
    renderBoard();
}

export async function deleteCurrentProject() {
    const currentProject = get('currentProject');
    if (!currentProject || !currentProject.id) return;
    const confirmed = await showConfirm('Delete "' + currentProject.name + '" and all its nodes?');
    if (!confirmed) return;

    try {
        await apiDeleteProject(currentProject.id);
        const projects = get('projects').filter(p => p.id !== currentProject.id);
        set('projects', projects);
        set('currentProject', null);
        set('currentNodes', []);
        set('expandedNodes', new Set());
        renderSidebar();
        renderBoard();
    } catch (e) {
        showError(String(e));
    }
}

async function deleteNodeByIndex(idx) {
    const currentNodes = get('currentNodes');
    const name = currentNodes[idx].title || 'this node';
    const confirmed = await showConfirm('Delete "' + name + '"?');
    if (!confirmed) return;
    try {
        await apiDeleteNode(currentNodes[idx].id);
        const newNodes = [...currentNodes];
        newNodes.splice(idx, 1);
        set('currentNodes', newNodes);

        const expandedNodes = get('expandedNodes');
        const newExpanded = new Set();
        expandedNodes.forEach(i => {
            if (i > idx) newExpanded.add(i - 1);
            else if (i < idx) newExpanded.add(i);
        });
        set('expandedNodes', newExpanded);
        renderBoard();
    } catch (e) {
        showError(String(e));
    }
}

async function addTimeline(nodeIdx) {
    const input = document.getElementById('main').querySelector(`[data-tl-idx="${nodeIdx}"]`);
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    const currentProject = get('currentProject');
    const currentNodes = get('currentNodes');
    try {
        await apiAddTimeline(currentNodes[nodeIdx].id, content);
        const nodes = await fetchNodes(currentProject.id);
        set('currentNodes', nodes);
        input.value = '';
        renderBoard();
    } catch (e) {
        showError(String(e));
    }
}

// Search
export async function handleSearch(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!query.trim()) {
        resultsEl.classList.remove('active');
        return;
    }

    try {
        const results = await apiSearch(query.trim());

        if (results.length === 0) {
            resultsEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">No results</div>';
        } else {
            resultsEl.innerHTML = results.map(r => `
                <div class="search-result-item" data-project-id="${r.project_id}">
                    <div class="name">${escapeHtml(r.name)}</div>
                    <div class="path">${escapeHtml(r.project_name)}${r.result_type === 'node' ? ' - Node' : ''}</div>
                </div>
            `).join('');

            resultsEl.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const projectId = parseInt(item.dataset.projectId);
                    jumpToResult(projectId);
                });
            });
        }
        resultsEl.classList.add('active');
    } catch (e) {
        resultsEl.innerHTML = '<div style="padding:16px;color:var(--danger);">Search failed</div>';
        resultsEl.classList.add('active');
    }
}

export function hideSearch() {
    document.getElementById('searchResults').classList.remove('active');
}

async function jumpToResult(projectId) {
    const projects = get('projects');
    const p = projects.find(x => x.id === projectId);
    if (!p) return;
    const { selectProject } = await import('./sidebar.js');
    await selectProject(p);
    document.getElementById('searchInput').value = '';
    hideSearch();
}
