// ── Settings Panel ────────────────────────────────────────────────
// Renders in the sidebar when sidebarMode === 'settings'

import { get, set } from './store.js';
import * as api from './api.js';
import { escapeHtml, showError } from './utils.js';
import { setTheme } from './theme.js';
import { renderSidebar } from './sidebar.js';
import { renderBoard } from './board.js';

let editingConfigId = null;  // null = viewing list, 0 = new in main, >0 = editing in main

export function renderSettings() {
    const configs = get('apiConfigs');
    const currentTheme = localStorage.getItem('theme') || 'auto';
    const version = document.body.dataset.appVersion || '—';

    let html = `
        <div class="settings-panel">
            <div class="settings-section" style="text-align:center;">
                <div class="sidebar-title">Version</div>
                <div class="settings-field-value">${escapeHtml(version)}</div>
            </div>

            <div class="settings-section">
                <div class="sidebar-title">Theme</div>
                <select class="settings-select" id="themeSelect">
                    <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
                    <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
                    <option value="auto" ${currentTheme === 'auto' ? 'selected' : ''}>Auto</option>
                </select>
            </div>

            <div class="settings-section">
                <div class="sidebar-title">AI Models</div>
    `;

    if (configs.length === 0) {
        html += '<div class="settings-hint">No API configurations yet. Add one to use AI chat.</div>';
    } else {
        configs.forEach(function (c) {
            html += '<div class="settings-config-card" data-edit-id="' + c.id + '">';
            html += '<div class="settings-config-name">' + escapeHtml(c.name) + '</div>';
            html += '<div class="settings-config-model">' + escapeHtml(c.model) + '</div>';
            html += '<button class="settings-config-delete" data-delete-id="' + c.id + '" title="Delete">×</button>';
            html += '</div>';
        });
    }
    html += '<button class="settings-add-btn" id="addConfigBtn">+ Add Config</button>';

    html += '</div></div>';

    const content = document.getElementById('sidebarContent');
    if (content) {
        content.innerHTML = html;
        bindSettingsEvents();
    }
}

function bindSettingsEvents() {
    // Theme select
    var themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', function () {
            setTheme(this.value);
            renderSettings();
        });
    }

    // Edit config card click
    document.querySelectorAll('.settings-config-card').forEach(function (el) {
        el.addEventListener('click', function (e) {
            if (e.target.closest('button')) return;
            var id = parseInt(el.dataset.editId);
            var configs = get('apiConfigs');
            var config = configs.find(function (c) { return c.id === id; });
            if (config) {
                editingConfigId = id;
                renderConfigFormInMain(config);
            }
        });
    });

    // Delete config
    document.querySelectorAll('.settings-config-delete').forEach(function (el) {
        el.addEventListener('click', async function (e) {
            e.stopPropagation();
            var id = parseInt(el.dataset.deleteId);
            var configs = get('apiConfigs');
            var name = (configs.find(function (c) { return c.id === id; }) || {}).name || 'this config';
            var confirmed = confirm('Delete "' + name + '"?');
            if (!confirmed) return;
            try {
                await api.deleteApiConfig(id);
                set('apiConfigs', configs.filter(function (c) { return c.id !== id; }));
                var selectedId = get('selectedApiConfigId');
                if (selectedId === id) set('selectedApiConfigId', null);
                renderSettings();
            } catch (e) {
                showError(String(e));
            }
        });
    });

    // Add config button
    var addBtn = document.getElementById('addConfigBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function () {
            editingConfigId = 0;
            renderConfigFormInMain(null);
        });
    }
}

function renderConfigFormInMain(editingConfig) {
    var main = document.getElementById('main');
    if (!main) return;

    main.innerHTML = `
        <div class="config-form-main">
            <div class="config-form-title">${editingConfig ? 'Edit API Config' : 'Add API Config'}</div>
            <label class="settings-label">Name</label>
            <input class="settings-input" id="cfgName" placeholder="e.g. OpenAI GPT-4o" value="${editingConfig ? escapeHtml(editingConfig.name) : ''}">
            <label class="settings-label">API Key</label>
            <input class="settings-input" type="password" id="cfgApiKey" placeholder="sk-..." value="${editingConfig ? escapeHtml(editingConfig.api_key) : ''}">
            <label class="settings-label">Base URL</label>
            <input class="settings-input" id="cfgBaseUrl" placeholder="https://api.openai.com/v1" value="${editingConfig ? escapeHtml(editingConfig.base_url) : ''}">
            <label class="settings-label">Model</label>
            <input class="settings-input" id="cfgModel" placeholder="gpt-4o" value="${editingConfig ? escapeHtml(editingConfig.model) : ''}">
            <label class="settings-label">System Prompt (optional)</label>
            <textarea class="settings-textarea" id="cfgSystemPrompt" placeholder="You are a helpful assistant...">${editingConfig ? escapeHtml(editingConfig.system_prompt || '') : ''}</textarea>
            <div class="config-form-actions">
                <button class="btn" data-variant="primary" id="saveConfigBtn">${editingConfig ? 'Save' : 'Add'}</button>
                <button class="btn" id="cancelConfigBtn">Cancel</button>
            </div>
        </div>
    `;

    // Save config
    document.getElementById('saveConfigBtn').addEventListener('click', async function () {
        var name = document.getElementById('cfgName').value.trim();
        var apiKey = document.getElementById('cfgApiKey').value.trim();
        var baseUrl = document.getElementById('cfgBaseUrl').value.trim();
        var model = document.getElementById('cfgModel').value.trim();
        var systemPrompt = document.getElementById('cfgSystemPrompt').value.trim();
        if (!name || !apiKey || !baseUrl || !model) {
            showError('Name, API Key, Base URL, and Model are required');
            return;
        }
        try {
            var configs = get('apiConfigs');
            if (editingConfigId > 0) {
                await api.updateApiConfig(editingConfigId, name, apiKey, baseUrl, model, systemPrompt);
                set('apiConfigs', configs.map(function (c) {
                    return c.id === editingConfigId ? Object.assign({}, c, { name: name, api_key: apiKey, base_url: baseUrl, model: model, system_prompt: systemPrompt }) : c;
                }));
            } else {
                var created = await api.createApiConfig(name, apiKey, baseUrl, model, systemPrompt);
                set('apiConfigs', configs.concat(created));
            }
            editingConfigId = null;
            renderBoard();
            renderSettings();
        } catch (e) {
            showError(String(e));
        }
    });

    // Cancel config
    document.getElementById('cancelConfigBtn').addEventListener('click', function () {
        editingConfigId = null;
        renderBoard();
    });
}
