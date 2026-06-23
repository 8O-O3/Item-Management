// ── Reactive State Management ───────────────────────────────────
// Bridges Alpine.js reactivity with the imperative store.

const state = {
    folders: [],
    projects: [],
    currentFolder: null,
    currentProject: null,
    currentNodes: [],
    expandedNodes: new Set(),
    expandedFolders: new Set(),
    sidebarMode: 'tree',    // 'tree' | 'settings'
    apiConfigs: [],
    selectedApiConfigId: null,
    chatSessions: [],
    currentSessionId: null,
    chatContextSelections: { folderIds: [], projectIds: [], nodeIds: [] },
};

const listeners = new Map();

export function get(key) {
    return state[key];
}

export function set(key, value) {
    state[key] = value;
    notify(key);
    // Sync to Alpine store if available
    syncToAlpine(key, value);
}

// ── Alpine.js Bridge ──────────────────────────────────────────
// Initialize when Alpine is ready. If Alpine already loaded, call directly.

function syncToAlpine(key, value) {
    if (window.Alpine && Alpine.store('app')) {
        // Alpine stores don't support Set via Proxy, so convert for display
        if (value instanceof Set) {
            Alpine.store('app')[key] = [...value];
        } else {
            Alpine.store('app')[key] = value;
        }
    }
}

export function initAlpineBridge() {
    if (!window.Alpine) return;
    Alpine.store('app', {
        folders: state.folders,
        projects: state.projects,
        currentFolder: state.currentFolder,
        currentProject: state.currentProject,
        currentNodes: state.currentNodes,
        expandedNodes: [...state.expandedNodes],
        expandedFolders: [...state.expandedFolders],
        sidebarMode: state.sidebarMode,
        apiConfigs: state.apiConfigs,
        selectedApiConfigId: state.selectedApiConfigId,
        chatSessions: state.chatSessions,
        currentSessionId: state.currentSessionId,
        chatContextSelections: state.chatContextSelections,
    });
}

// Also listen for alpine:init in case store.js loads before Alpine
document.addEventListener('alpine:init', () => {
    initAlpineBridge();
});

// ── Pub/Sub ───────────────────────────────────────────────────

export function on(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key)?.delete(fn);
}

export function onAll(keys, fn) {
    const unsubs = keys.map(k => on(k, fn));
    return () => unsubs.forEach(u => u());
}

function notify(key) {
    const fns = listeners.get(key);
    if (fns) fns.forEach(fn => fn(state[key]));
}

export function batch(fn) {
    fn(state);
    notify('folders-changed');
    notify('projects-changed');
    notify('board-render');
}

export function getState() {
    return state;
}

export default { get, set, on, onAll, batch, getState, initAlpineBridge };
