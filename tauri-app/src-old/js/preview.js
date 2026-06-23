// ── File Preview & Download ─────────────────────────────────────

import { get } from './store.js';
import { saveNodeFile, extractDocxText } from './api.js';
import { escapeHtml, showError } from './utils.js';

let previewFileData = null;
let previewFileName = null;

function getMimeType(dataUrl) {
    const m = dataUrl.match(/^data:([^;]+)/);
    return m ? m[1] : null;
}

export async function openPreviewModal(name, data) {
    previewFileData = data;
    previewFileName = name;
    document.getElementById('previewTitle').textContent = name;
    const content = document.getElementById('previewContent');
    const dlBtn = document.getElementById('previewDownloadBtn');
    dlBtn.style.display = 'inline-flex';

    const mime = getMimeType(data || '');
    const isDocx = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (mime && mime.startsWith('image/')) {
        content.innerHTML = `<img src="${data}" style="max-width:100%;max-height:60vh;border-radius:8px;" alt="${escapeHtml(name)}">`;
    } else if (mime === 'application/pdf') {
        content.innerHTML = `<iframe src="${data}" style="width:100%;height:60vh;border:none;border-radius:8px;"></iframe>`;
    } else if (isDocx) {
        content.innerHTML = `<div style="padding:20px;color:var(--text-secondary);">Loading document text...</div>`;
        if (window.Alpine?.store('modal')) Alpine.store('modal').preview = true;
        try {
            const text = await extractDocxText(data);
            content.innerHTML = `<pre style="text-align:left;max-height:60vh;overflow:auto;background:var(--surface);padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;">${escapeHtml(text)}</pre>`;
        } catch (e) {
            content.innerHTML = `<div style="padding:60px;color:var(--text-secondary);"><div>Could not extract text</div><div style="font-size:12px;margin-top:8px;">${escapeHtml(String(e))}</div></div>`;
        }
        return;
    } else if (mime && mime.startsWith('text/')) {
        const text = atob((data || '').split(',')[1] || '');
        content.innerHTML = `<pre style="text-align:left;max-height:60vh;overflow:auto;background:var(--surface);padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;">${escapeHtml(text)}</pre>`;
    } else {
        content.innerHTML = `<div style="padding:60px;color:var(--text-secondary);"><div style="font-size:48px;margin-bottom:16px;opacity:0.4;">[ ]</div><div>Preview not available for this file type</div><div style="font-size:12px;margin-top:8px;">${mime || 'unknown'}</div></div>`;
    }
    if (window.Alpine?.store('modal')) Alpine.store('modal').preview = true;
}

export function closePreviewModal() {
    if (window.Alpine?.store('modal')) Alpine.store('modal').preview = false;
    previewFileData = null;
    previewFileName = null;
}

export function previewFile(nodeIdx, fileIdx) {
    const currentNodes = get('currentNodes');
    const file = currentNodes[nodeIdx]?.files?.[fileIdx];
    if (!file || !file.data) return;
    openPreviewModal(file.name, file.data);
}

export async function downloadFile(nodeIdx, fileIdx) {
    const currentNodes = get('currentNodes');
    const file = currentNodes[nodeIdx]?.files?.[fileIdx];
    if (!file || !file.data) return;
    try {
        const path = await window.__TAURI__.dialog.save({ defaultPath: file.name });
        if (!path) return;
        await saveNodeFile(file.data, path);
        try { await window.__TAURI__.shell.open(path); } catch (e) { /* ignore */ }
    } catch (e) {
        showError('Download failed: ' + (e?.toString?.() || e));
    }
}

export async function downloadPreviewedFile() {
    if (!previewFileData || !previewFileName) return;
    try {
        const path = await window.__TAURI__.dialog.save({ defaultPath: previewFileName });
        if (!path) return;
        await saveNodeFile(previewFileData, path);
        try { await window.__TAURI__.shell.open(path); } catch (e) { /* ignore */ }
    } catch (e) {
        showError('Download failed: ' + (e?.toString?.() || e));
    }
}
