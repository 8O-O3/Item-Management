// ── Theme Management ─────────────────────────────────────────────

export function getPreferredTheme() {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme) {
    if (theme === 'auto') {
        localStorage.removeItem('theme');
        document.documentElement.setAttribute('data-theme', getPreferredTheme());
    } else {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
    const stored = localStorage.getItem('theme');
    const effective = stored === 'dark' || stored === 'light' ? stored : getPreferredTheme();
    document.documentElement.setAttribute('data-theme', effective);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
}
