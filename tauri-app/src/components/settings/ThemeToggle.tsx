import { useSettingsStore } from '@/stores/settingsStore';

const themes = [
  { key: 'light' as const, label: 'Light' },
  { key: 'dark' as const, label: 'Dark' },
  { key: 'auto' as const, label: 'Auto' },
];

export default function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div className="flex px-2">
      <div className="flex-1 inline-flex bg-bg rounded-lg p-0.5 border border-border">
        {themes.map((t) => (
          <button
            key={t.key}
            className={`flex-1 text-xs py-1 rounded-[6px] transition-all duration-150 ${
              theme === t.key
                ? 'bg-surface text-text shadow-sm font-medium'
                : 'text-text-secondary hover:text-text'
            }`}
            onClick={() => setTheme(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
