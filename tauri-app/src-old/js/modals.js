// ── Modals — all dialog management ─────────────────────────────

import { get, set } from './store.js';
import * as api from './api.js';
import { escapeHtml, formatSize, showError } from './utils.js';
import { renderSidebar } from './sidebar.js';
import { renderBoard } from './board.js';

// ── Alpine Modal Store ─────────────────────────────────────────

const DEFAULT_MODAL_STATE = {
    folder: false,
    project: false,
    node: false,
    file: false,
    stats: false,
    preview: false,
    confirm: false,
};

function ensureModalStore() {
    if (!window.Alpine) return;
    if (!Alpine.store('modal')) {
        Alpine.store('modal', { ...DEFAULT_MODAL_STATE });
    }
}

function initModalStore() {
    if (!window.Alpine) return;
    // Always re-create during alpine:init so Alpine's reactivity wraps the data.
    Alpine.store('modal', { ...DEFAULT_MODAL_STATE });
    // Remove CSS pre-hide — x-show now controls visibility normally.
    document.body.classList.add('alpine-ready');
}

function setModal(name, value) {
    const modal = document.getElementById(name + 'Modal');
    if (!modal) return;
    modal.style.display = value ? 'flex' : 'none';
    if (value) void modal.offsetHeight;
    if (window.Alpine && Alpine.store('modal')) {
        Alpine.store('modal')[name] = value;
    }
}

// Emergency early init — covers the rare case Alpine already started.
ensureModalStore();
// Primary init — always fires at the right time for reactivity.
document.addEventListener('alpine:init', initModalStore);

// ── Folder Modal ────────────────────────────────────────────────

let editingFolderId = null;

function buildFolderOptions(folders, parentId = null, depth = 0, excludeId = null, stopAt = null) {
    if (depth >= 4) return '';
    let html = '';
    const children = folders.filter(f => f.parent_id === parentId && f.id !== excludeId);
    for (const f of children) {
        if (f.id === stopAt) continue;
        const indent = '  '.repeat(depth) + (depth > 0 ? '├ ' : '');
        html += `<option value="${f.id}">${indent}${escapeHtml(f.name)}</option>`;
        html += buildFolderOptions(folders, f.id, depth + 1, excludeId, stopAt);
    }
    return html;
}

export function openFolderModal(id = null, parentId = null) {
    editingFolderId = id;
    const folders = get('folders');
    document.getElementById('folderModalTitle').textContent = id ? 'Edit Folder' : 'New Folder';
    const input = document.getElementById('folderNameInput');
    input.value = id ? (folders.find(f => f.id === id)?.name || '') : '';
    const select = document.getElementById('folderParentSelect');
    select.innerHTML = '<option value="">No parent (root)</option>' + buildFolderOptions(folders, null, 0, id);
    select.value = id ? (folders.find(f => f.id === id)?.parent_id ?? '') : (parentId ?? '');
    select.style.display = id ? 'none' : '';
    setModal('folder', true);
    input.focus();
}

export function closeFolderModal() {
    setModal('folder', false);
    editingFolderId = null;
}

export async function confirmFolder() {
    const name = document.getElementById('folderNameInput').value.trim();
    if (!name) return;
    try {
        if (editingFolderId) {
            await api.updateFolder(editingFolderId, name);
            const folders = get('folders').map(f => f.id === editingFolderId ? { ...f, name } : f);
            set('folders', folders);
        } else {
            const select = document.getElementById('folderParentSelect');
            const parentId = select.value ? parseInt(select.value) : null;
            const folder = await api.createFolder(name, parentId);
            const folders = [...get('folders'), folder];
            set('folders', folders);
        }
        closeFolderModal();
        renderSidebar();
    } catch (e) {
        showError(String(e));
    }
}

// ── Confirm Dialog ─────────────────────────────────────────────

export function showConfirm(message) {
    return new Promise((resolve) => {
        const msgEl = document.getElementById('confirmMessage');
        msgEl.textContent = message;
        requestAnimationFrame(() => {
            setModal('confirm', true);
        });
        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        function cleanup() {
            setModal('confirm', false);
            document.getElementById('confirmOkBtn').removeEventListener('click', onOk);
            document.getElementById('confirmCancelBtn').removeEventListener('click', onCancel);
        }
        document.getElementById('confirmOkBtn').addEventListener('click', onOk);
        document.getElementById('confirmCancelBtn').addEventListener('click', onCancel);
        function onEscape(e) {
            if (e.key === 'Escape') { onCancel(); }
        }
        document.addEventListener('keydown', onEscape);
        const origCleanup = cleanup;
        cleanup = () => { document.removeEventListener('keydown', onEscape); origCleanup(); };
    });
}

// ── Folder Delete ─────────────────────────────────────────────

export async function deleteFolder(id) {
    const folders = get('folders');
    const name = folders.find(f => f.id === id)?.name || 'this folder';
    const confirmed = await showConfirm(`Delete "${name}" and all its contents?`);
    if (!confirmed) return;
    try {
        await api.deleteFolder(id);
        const remaining = folders.filter(f => f.id !== id);
        set('folders', remaining);
        const deletedIds = new Set();
        function collectDescendants(pid) {
            folders.filter(f => f.parent_id === pid).forEach(f => {
                deletedIds.add(f.id);
                collectDescendants(f.id);
            });
        }
        collectDescendants(id);
        const projects = get('projects').filter(p => !deletedIds.has(p.folder_id) && p.folder_id !== id);
        set('projects', projects);
        if (get('currentFolder') === id) set('currentFolder', null);
        renderSidebar();
        renderBoard();
    } catch (e) {
        showError(String(e));
    }
}

// ── Project Modal ──────────────────────────────────────────────

let editingProjectId = null;

export function openProjectModal(id = null, presetFolderId = null) {
    editingProjectId = id;
    const folders = get('folders');
    const projects = get('projects');
    const project = id ? projects.find(p => p.id === id) : null;

    document.getElementById('projectModalTitle').textContent = id ? 'Edit Project' : 'New Project';
    const select = document.getElementById('projectFolderSelect');
    select.innerHTML = '<option value="">No folder</option>' + buildFolderOptions(folders);

    if (project) {
        document.getElementById('projectNameInput').value = project.name || '';
        document.getElementById('projectDescInput').value = project.desc || '';
        select.value = project.folder_id ?? '';
    } else {
        document.getElementById('projectNameInput').value = '';
        document.getElementById('projectDescInput').value = '';
        select.value = presetFolderId ?? '';
    }

    setModal('project', true);
    document.getElementById('projectNameInput').focus();
}

export function closeProjectModal() {
    setModal('project', false);
    editingProjectId = null;
}

export async function confirmProject() {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) return;
    const folderSelect = document.getElementById('projectFolderSelect').value;
    const folderId = folderSelect ? parseInt(folderSelect) : null;
    const desc = document.getElementById('projectDescInput').value.trim() || null;
    try {
        if (editingProjectId) {
            await api.updateProject(editingProjectId, name, desc, folderId);
            const projects = get('projects').map(p => p.id === editingProjectId ? { ...p, name, desc, folder_id: folderId } : p);
            set('projects', projects);
            closeProjectModal();
            renderSidebar();
            renderBoard();
        } else {
            const project = await api.createProject(name, desc, folderId);
            const projects = [...get('projects'), project];
            set('projects', projects);
            closeProjectModal();
            set('expandedNodes', new Set());
            renderSidebar();
            const { selectProject } = await import('./sidebar.js');
            await selectProject(project);
        }
    } catch (e) {
        showError(String(e));
    }
}

// ── Node Modal ─────────────────────────────────────────────────

let editingNodeIdx = null;

export function openNodeModal(idx = null) {
    editingNodeIdx = idx;
    document.getElementById('nodeModalTitle').textContent = idx !== null ? 'Edit Node' : 'Add Node';
    document.getElementById('nodeConfirmBtn').textContent = idx !== null ? 'Save' : 'Add';
    const currentNodes = get('currentNodes');
    if (idx !== null && currentNodes[idx]) {
        document.getElementById('nodeTitleInput').value = currentNodes[idx].title || '';
        document.getElementById('nodeDescInput').value = currentNodes[idx].desc || '';
    } else {
        document.getElementById('nodeTitleInput').value = '';
        document.getElementById('nodeDescInput').value = '';
    }
    setModal('node', true);
    document.getElementById('nodeTitleInput').focus();
}

export function closeNodeModal() {
    setModal('node', false);
    editingNodeIdx = null;
}

export async function confirmNode() {
    const title = document.getElementById('nodeTitleInput').value.trim();
    const desc = document.getElementById('nodeDescInput').value.trim() || null;
    const currentProject = get('currentProject');
    if (!title || !currentProject?.id) return;
    try {
        if (editingNodeIdx !== null) {
            const currentNodes = get('currentNodes');
            await api.updateNode(currentNodes[editingNodeIdx].id, title, desc);
            const newNodes = [...currentNodes];
            newNodes[editingNodeIdx] = { ...newNodes[editingNodeIdx], title, desc };
            set('currentNodes', newNodes);
        } else {
            const node = await api.createNode(currentProject.id, title, desc);
            const currentNodes = [...get('currentNodes'), node];
            set('currentNodes', currentNodes);
        }
        closeNodeModal();
        renderBoard();
    } catch (e) {
        showError(String(e));
    }
}

// ── File Modal ─────────────────────────────────────────────────

let fileContext = null;
let pendingFiles = [];

export function openFileModal(nodeIdx) {
    fileContext = { nodeIdx };
    pendingFiles = [];
    renderFileModal();
    setModal('file', true);
}

export function closeFileModal() {
    setModal('file', false);
    fileContext = null;
    pendingFiles = [];
}

function renderFileModal() {
    const pendingEl = document.getElementById('pendingFiles');
    const existingEl = document.getElementById('existingFiles');
    const currentNodes = get('currentNodes');
    const node = currentNodes[fileContext?.nodeIdx];
    const existing = node?.files || [];

    pendingEl.innerHTML = pendingFiles.length
        ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">Pending:</div>` +
          pendingFiles.map((f, i) => `
              <div class="file-item">
                  <div class="info"><div class="name">${escapeHtml(f.name)}</div><div class="size">${formatSize(f.size)}</div></div>
                  <div class="remove" data-action="remove-pending" data-idx="${i}">x</div>
              </div>
          `).join('')
        : '';

    existingEl.innerHTML = existing.length
        ? `<div style="font-size:12px;color:var(--text-secondary);margin:18px 0 10px;">Attached:</div>` +
          existing.map((f, i) => `
              <div class="file-item">
                  <div class="info"><div class="name">${escapeHtml(f.name)}</div>${f.size ? `<div class="size">${formatSize(f.size)}</div>` : ''}</div>
                  <div class="remove" data-action="remove-existing" data-idx="${i}">x</div>
              </div>
          `).join('')
        : '';

    // Bind pending remove buttons
    pendingEl.querySelectorAll('[data-action="remove-pending"]').forEach(el => {
        el.addEventListener('click', () => removePending(parseInt(el.dataset.idx)));
    });

    // Bind existing remove buttons
    existingEl.querySelectorAll('[data-action="remove-existing"]').forEach(el => {
        el.addEventListener('click', () => removeExistingFile(parseInt(el.dataset.idx)));
    });
}

export function handleFileSelect(e) {
    addFiles(Array.from(e.target.files));
}

function addFiles(files) {
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
            pendingFiles.push({
                name: file.name,
                size: file.size,
                type: file.type,
                data: reader.result,
                path: '',
            });
            renderFileModal();
        };
        reader.readAsDataURL(file);
    });
}

function removePending(idx) {
    pendingFiles.splice(idx, 1);
    renderFileModal();
}

export async function confirmFiles() {
    const currentNodes = get('currentNodes');
    const currentProject = get('currentProject');
    const nodeIdx = fileContext.nodeIdx;
    for (const f of pendingFiles) {
        try {
            await api.addFileToNode(currentNodes[nodeIdx].id, f.name, f.path || '', f.size || null, f.data || null);
        } catch (e) {
            showError(String(e));
        }
    }
    try {
        const nodes = await api.fetchNodes(currentProject.id);
        set('currentNodes', nodes);
    } catch (e) { /* ignore */ }
    closeFileModal();
    renderBoard();
}

async function removeExistingFile(fileIdx) {
    const currentNodes = get('currentNodes');
    const currentProject = get('currentProject');
    try {
        await api.removeFileFromNode(currentNodes[fileContext.nodeIdx].id, fileIdx);
        const nodes = await api.fetchNodes(currentProject.id);
        set('currentNodes', nodes);
        renderFileModal();
    } catch (e) {
        showError(String(e));
    }
}

// Direct file delete from board (no modal)
export async function removeExistingFileDirect(nodeIdx, fileIdx) {
    const currentNodes = get('currentNodes');
    const currentProject = get('currentProject');
    try {
        await api.removeFileFromNode(currentNodes[nodeIdx].id, fileIdx);
        const nodes = await api.fetchNodes(currentProject.id);
        set('currentNodes', nodes);
        renderBoard();
    } catch (e) {
        showError(String(e));
    }
}

// ── Stats Modal ─────────────────────────────────────────────────

export function openStatsModal() {
    const currentProject = get('currentProject');
    const currentNodes = get('currentNodes');
    const projects = get('projects');
    const folders = get('folders');

    const totalProjects = projects.length;
    const totalNodes = currentProject ? currentNodes.length : 0;
    const totalFiles = currentNodes.reduce((sum, n) => sum + (n.files || []).length, 0);
    const totalTimeline = currentNodes.reduce((sum, n) => sum + (n.timeline || []).length, 0);
    const foldersCount = folders.length;

    document.getElementById('statsContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="stat-card"><div class="stat-value">${totalProjects}</div><div class="stat-label">Projects</div></div>
            <div class="stat-card"><div class="stat-value">${foldersCount}</div><div class="stat-label">Folders</div></div>
            <div class="stat-card"><div class="stat-value">${totalNodes}</div><div class="stat-label">Nodes</div></div>
            <div class="stat-card"><div class="stat-value">${totalFiles}</div><div class="stat-label">Files</div></div>
            <div class="stat-card"><div class="stat-value">${totalTimeline}</div><div class="stat-label">Timeline Records</div></div>
        </div>
    `;
    setModal('stats', true);
}

export function closeStatsModal() {
    setModal('stats', false);
}

export async function openAppDataDir() {
    try { await api.openAppDir(); } catch (e) { /* ignore */ }
}

