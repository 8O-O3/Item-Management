export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const offset = -d.getTimezoneOffset();
    const offsetStr = `UTC${offset >= 0 ? '+' : ''}${Math.floor(offset / 60)}:${String(Math.abs(offset % 60)).padStart(2, '0')}`;
    return `${d.toLocaleString()} (${offsetStr})`;
  } catch {
    return iso;
  }
}
