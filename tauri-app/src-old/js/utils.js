// ── Utility Functions ───────────────────────────────────────────

export function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function formatTime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    try {
        const parts = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(d);
        const tz = parts.find(p => p.type === 'timeZoneName')?.value || '';
        return `${month}/${day} ${hours}:${minutes} ${tz}`;
    } catch {
        return `${month}/${day} ${hours}:${minutes}`;
    }
}

export function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function showError(msg) {
    const el = document.getElementById('errorToast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
}

export function handleEnterKey(e, callback) {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        callback();
    }
}

// ── Hover Tooltip (shared) ───────────────────────────────────────

let _tooltipEl = null;
let _tooltipTimer = null;

function _getTooltipEl() {
    if (!_tooltipEl) {
        _tooltipEl = document.createElement('div');
        _tooltipEl.className = 'hover-tooltip';
        document.body.appendChild(_tooltipEl);
    }
    return _tooltipEl;
}

export function bindTextTooltips(container) {
    container.addEventListener('mouseover', function (e) {
        var target = e.target.closest('.tree-name, .file-chip .file-name');
        if (!target) return;
        if (target.scrollWidth > target.clientWidth) {
            if (_tooltipTimer) clearTimeout(_tooltipTimer);
            _tooltipTimer = setTimeout(function () {
                var rect = target.getBoundingClientRect();
                var tip = _getTooltipEl();
                tip.textContent = target.textContent;
                tip.style.left = (rect.left + rect.width / 2) + 'px';
                tip.style.top = (rect.top - 8) + 'px';
                tip.classList.add('active');
            }, 500);
        }
    });

    container.addEventListener('mouseout', function (e) {
        var target = e.target.closest('.tree-name, .file-chip .file-name');
        if (!target) return;
        if (_tooltipTimer) clearTimeout(_tooltipTimer);
        _getTooltipEl().classList.remove('active');
    });
}
