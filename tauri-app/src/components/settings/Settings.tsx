import { useSettingsStore } from '@/stores/settingsStore';
import ThemeToggle from './ThemeToggle';

export default function Settings() {
  const configs = useSettingsStore((s) => s.apiConfigs);
  const selectedId = useSettingsStore((s) => s.selectedApiConfigId);
  const selectConfig = useSettingsStore((s) => s.selectConfig);
  const deleteConfig = useSettingsStore((s) => s.deleteConfig);
  const setEditingConfig = useSettingsStore((s) => s.setEditingConfig);
  const version = document.body.dataset.appVersion || '';

  return (
    <div className="space-y-4">
      {/* Version */}
      {version && (
        <div className="sidebar-section">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-2 mb-2">About</div>
          <div className="px-2 py-1.5 rounded-md text-sm text-text-secondary select-none">
            <span className="text-text font-medium">Project Manager</span>
            <span className="ml-2 text-xs">{version}</span>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-2 mb-2">Appearance</div>
        <ThemeToggle />
      </div>

      <div className="sidebar-section">
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-2 mb-2">API Configs</div>
        {configs.map((c) => (
          <div
            key={c.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer group transition select-none ${
              c.id === selectedId ? 'bg-accent/10 text-accent' : 'text-text hover:bg-surface'
            }`}
            onClick={() => selectConfig(c.id!)}
            onDoubleClick={() => setEditingConfig(c.id!)}
          >
            <span className="flex-1 truncate">{c.name}</span>
            <span className="text-xs text-text-secondary truncate">{c.model}</span>
            <button
              className="shrink-0 opacity-0 group-hover:opacity-100 text-xs text-danger hover:text-danger-hover transition"
              onClick={(e) => { e.stopPropagation(); deleteConfig(c.id!); }}
            >×</button>
          </div>
        ))}
        <button
          className="w-full text-xs py-1.5 mt-2 rounded-md bg-surface hover:bg-accent/10 text-text-secondary hover:text-accent transition"
          onClick={() => setEditingConfig(-1)}
        >+ Add API Config</button>
      </div>
    </div>
  );
}
