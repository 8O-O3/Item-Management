// ── Entry Point ─────────────────────────────────────────────────
import { set, get } from './store.js';
import * as api from './api.js';
import { showError, handleEnterKey } from './utils.js';
import { initTheme } from './theme.js';
import { renderSidebar, selectProject, toggleSettings } from './sidebar.js';
import {
    closeFolderModal, closeProjectModal, closeNodeModal, closeFileModal, closeStatsModal,
    openFolderModal, confirmFolder,
    openProjectModal, confirmProject,
    openNodeModal, confirmNode,
    openFileModal, confirmFiles, handleFileSelect,
    openStatsModal, openAppDataDir,
} from './modals.js';
import { closePreviewModal, downloadPreviewedFile } from './preview.js';
import { closeChat, sendChatMessage, stopChatMessage, handleChatKey, toggleChat, clearChat, updateModelSelector, handleModelSelectChange, newChatSession } from './chat.js';
import { renderBoard, handleSearch, hideSearch } from './board.js';

// ── Init ──────────────────────────────────────────────────────

async function init() {
    initTheme();

    try {
        const [folders, projects, configs, sessions] = await Promise.all([
            api.fetchFolders(),
            api.fetchProjects(),
            api.fetchApiConfigs(),
            api.getChatSessions(),
        ]);
        set('folders', folders);
        set('projects', projects);
        set('apiConfigs', configs);
        set('chatSessions', sessions);
    } catch (e) {
        showError('Failed to load data: ' + e);
    }

    renderSidebar();
    updateModelSelector();

    // Auto-migrate old localStorage AI settings if no configs exist
    try {
        const configs = get('apiConfigs');
        if (configs.length === 0) {
            const oldSettings = localStorage.getItem('ai_settings');
            if (oldSettings) {
                const s = JSON.parse(oldSettings);
                if (s.apiKey && s.baseUrl && s.model) {
                    const created = await api.createApiConfig('Default', s.apiKey, s.baseUrl, s.model, s.systemPrompt || '');
                    set('apiConfigs', [created]);
                    set('selectedApiConfigId', created.id);
                    localStorage.removeItem('ai_settings');
                    updateModelSelector();
                }
            }
        }
    } catch (e) { /* non-critical */ }

    // Show version from backend
    try {
        const version = await api.getVersion();
        document.body.dataset.appVersion = 'v' + version;
    } catch (e) { /* non-critical */ }

    const projects = get('projects');
    if (projects.length > 0) {
        await selectProject(projects[0]);
    }
}

// ── Global Event Handlers ─────────────────────────────────────

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeFolderModal();
        closeProjectModal();
        closeNodeModal();
        closeFileModal();
        closeStatsModal();
        closePreviewModal();
        closeChat();
    }
});

// Enter key handlers for modal inputs
document.getElementById('folderNameInput').addEventListener('keydown', (e) => handleEnterKey(e, confirmFolder));
document.getElementById('projectNameInput').addEventListener('keydown', (e) => handleEnterKey(e, confirmProject));
document.getElementById('nodeTitleInput').addEventListener('keydown', (e) => handleEnterKey(e, confirmNode));

// File upload drag & drop
const uploadZone = document.getElementById('uploadZone');
if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        import('./modals.js').then(m => {
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = () => {
                    // Access internal addFiles — exposed via handleFileSelect
                    m.handleFileSelect({ target: { files: [file] } });
                };
                reader.readAsDataURL(file);
            });
        });
    });
}

// Chat input auto-resize
const chatInput = document.getElementById('chatInput');
if (chatInput) {
    chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

// Search input blur
document.getElementById('searchInput').addEventListener('blur', () => {
    setTimeout(() => hideSearch(), 200);
});

// ── Export & Import ───────────────────────────────────────────

async function exportData() {
    try {
        if (window.__TAURI__?.dialog?.save) {
            const path = await window.__TAURI__.dialog.save({
                defaultPath: `project-manager-${new Date().toISOString().slice(0, 10)}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }],
            });
            if (!path) return;
            await api.saveExport(path);
            try { await window.__TAURI__.shell.open(path); } catch (e) { /* ignore */ }
        }
    } catch (e) {
        showError('Export failed: ' + (e?.toString?.() || e));
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            await api.importData(e.target.result);
            set('folders', await api.fetchFolders());
            set('projects', await api.fetchProjects());
            renderSidebar();
            const projects = get('projects');
            if (projects.length > 0) await selectProject(projects[0]);
            alert('Import successful!');
        } catch (err) {
            showError('Import failed: ' + (err?.toString?.() || err));
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ── Expose to global scope (needed by inline onclick in HTML) ─

window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.stopChatMessage = stopChatMessage;
window.handleChatKey = handleChatKey;
window.clearChat = clearChat;
window.closeChat = closeChat;
window.updateModelSelector = updateModelSelector;
window.handleModelSelectChange = handleModelSelectChange;
window.toggleSettings = toggleSettings;
window.newChatSession = newChatSession;

// Close context picker when clicking outside
document.addEventListener('click', function (e) {
    var picker = document.getElementById('contextPicker');
    var badge = document.getElementById('chatContextBadge');
    if (picker && picker.style.display === 'block') {
        if (!picker.contains(e.target) && e.target !== badge && !badge.contains(e.target)) {
            picker.style.display = 'none';
        }
    }
});

window.openFolderModal = openFolderModal;
window.closeFolderModal = closeFolderModal;
window.confirmFolder = confirmFolder;

window.openProjectModal = openProjectModal;
window.closeProjectModal = closeProjectModal;
window.confirmProject = confirmProject;

window.openNodeModal = openNodeModal;
window.closeNodeModal = closeNodeModal;
window.confirmNode = confirmNode;

window.openFileModal = openFileModal;
window.closeFileModal = closeFileModal;
window.confirmFiles = confirmFiles;
window.handleFileSelect = handleFileSelect;

window.openStatsModal = openStatsModal;
window.closeStatsModal = closeStatsModal;
window.openAppDataDir = openAppDataDir;

window.closePreviewModal = closePreviewModal;
window.downloadPreviewedFile = downloadPreviewedFile;

window.exportData = exportData;
window.importData = importData;
window.handleSearch = handleSearch;
window.hideSearch = hideSearch;

// ── Start ─────────────────────────────────────────────────────

init().catch(console.error);
