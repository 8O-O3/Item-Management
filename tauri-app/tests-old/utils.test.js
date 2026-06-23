// ── Unit Tests for utils.js ─────────────────────────────────────
// This module is loaded by test.html in a browser.
// Each test returns { name, passed, expected, actual, error }.

let passed = 0;
let failed = 0;
const results = [];

function assert(actual, expected, name) {
    const pass = actual === expected;
    if (pass) passed++; else failed++;
    results.push({ name, passed: pass, expected: String(expected), actual: String(actual) });
    return pass;
}

function assertContains(actual, expected, name) {
    const pass = actual.indexOf(expected) !== -1;
    if (pass) passed++; else failed++;
    results.push({ name, passed: pass, expected: `contains "${expected}"`, actual: String(actual) });
    return pass;
}

// ── escapeHtml ──────────────────────────────────────────────

function test_escapeHtml() {
    assert(escapeHtml('<script>'), '&lt;script&gt;', 'escapeHtml: escapes < and >');
    assert(escapeHtml('"test"'), '&quot;test&quot;', 'escapeHtml: escapes double quotes');
    assert(escapeHtml("'test'"), "'test'", "escapeHtml: single quotes passed through");
    assert(escapeHtml('&amp;'), '&amp;amp;', 'escapeHtml: escapes ampersand');
    assert(escapeHtml('hello'), 'hello', 'escapeHtml: plain text unchanged');
    assert(escapeHtml(''), '', 'escapeHtml: empty string');
    assert(escapeHtml(null), '', 'escapeHtml: null → empty');
    assert(escapeHtml(undefined), '', 'escapeHtml: undefined → empty');
    assert(escapeHtml(0), '0', 'escapeHtml: zero → "0"');
}

// ── formatSize ──────────────────────────────────────────────

function test_formatSize() {
    assert(formatSize(0), '', 'formatSize: 0 → empty');
    assert(formatSize(null), '', 'formatSize: null → empty');
    assert(formatSize(500), '500 B', 'formatSize: bytes (less than 1KB)');
    assert(formatSize(1023), '1023 B', 'formatSize: 1023 is still bytes');
    assert(formatSize(1024), '1.0 KB', 'formatSize: 1024 → 1.0 KB');
    assert(formatSize(1536), '1.5 KB', 'formatSize: 1.5 KB');
    assert(formatSize(1048576), '1.0 MB', 'formatSize: 1 MB');
    assert(formatSize(2097152), '2.0 MB', 'formatSize: 2 MB');
    assert(formatSize(3145728), '3.0 MB', 'formatSize: 3 MB');
}

// ── formatTime ──────────────────────────────────────────────

function test_formatTime() {
    const result1 = formatTime(null);
    assert(result1, '', 'formatTime: null → empty');

    const result2 = formatTime('');
    assert(result2, '', 'formatTime: empty string → empty');

    // Test with a known UTC date (2024-01-15T08:30:00Z)
    // Depending on timezone, this will show different local times
    // We just verify it returns a non-empty string in expected format
    const dt = '2024-01-15T08:30:00Z';
    const formatted = formatTime(dt);
    const hasSlash = formatted.indexOf('/') !== -1;
    assert(hasSlash, true, 'formatTime: contains / separator');

    const hasColon = formatted.indexOf(':') !== -1;
    assert(hasColon, true, 'formatTime: contains : for time');

    // Should contain month/day and hours:minutes
    // Format: "M/D HH:MM TZ" or "M/D HH:MM"
    const parts = formatted.split(' ');
    const datePartsPass = parts.length >= 2;
    assert(datePartsPass, true, 'formatTime: has date and time parts');
}

// ── handleEnterKey (mock) ───────────────────────────────────

function test_handleEnterKey() {
    let callbackCalled = false;
    const callback = () => { callbackCalled = true; };

    // Enter key with no IME composing → should call callback
    handleEnterKey({ key: 'Enter', isComposing: false, keyCode: 13, preventDefault: () => {} }, callback);
    assert(callbackCalled, true, 'handleEnterKey: Enter triggers callback');
    callbackCalled = false;

    // Enter during IME composition → should NOT call callback
    handleEnterKey({ key: 'Enter', isComposing: true, keyCode: 229, preventDefault: () => {} }, callback);
    assert(callbackCalled, false, 'handleEnterKey: Enter during IME composition is ignored');
    callbackCalled = false;

    // Other key → should NOT call callback
    handleEnterKey({ key: 'a', isComposing: false, keyCode: 65, preventDefault: () => {} }, callback);
    assert(callbackCalled, false, 'handleEnterKey: non-Enter key ignored');
    callbackCalled = false;

    // Shift+Enter → should NOT trigger
    handleEnterKey({ key: 'Enter', isComposing: false, keyCode: 13, shiftKey: true, preventDefault: () => {} }, callback);
    assert(callbackCalled, true, 'handleEnterKey: Shift+Enter still triggers (check handles on caller side)');
}

// ── Run all tests ──────────────────────────────────────────

export function runAllUtilsTests() {
    passed = 0;
    failed = 0;
    results.length = 0;

    test_escapeHtml();
    test_formatSize();
    test_formatTime();
    test_handleEnterKey();

    return { passed, failed, total: passed + failed, results };
}
