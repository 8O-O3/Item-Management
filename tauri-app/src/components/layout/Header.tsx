import { useAppStore } from '@/stores/appStore';
import { systemApi } from '@/api';
import { useCallback, useRef } from 'react';
import SearchBox from './SearchBox';

export default function Header() {
  const selectProject = useAppStore((s) => s.selectProject);
  const loadData = useAppStore((s) => s.loadData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    try {
      if (window.__TAURI__?.dialog?.save) {
        const path = await window.__TAURI__.dialog.save({
          defaultPath: `project-manager-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!path) return;
        await systemApi.saveExport(path);
        await window.__TAURI__?.shell?.open?.(path);
      }
    } catch (e) {
      console.error('Export failed:', e);
    }
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await systemApi.importData(ev.target?.result as string);
        await loadData();
        const updatedProjects = useAppStore.getState().projects;
        if (updatedProjects.length > 0) {
          await selectProject(updatedProjects[0]);
        }
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadData, selectProject]);

  return (
    <header className="glass-medium shrink-0 flex items-center gap-2 px-5 py-2 border-b border-border z-10">
      <h1 className="text-[15px] font-semibold text-text mr-3 shrink-0 tracking-tight select-none">Project Manager</h1>
      <div className="flex-1" />
      <SearchBox />
      <button className="btn-ghost text-[13px]" onClick={handleExport}>Export</button>
      <button className="btn-ghost text-[13px]" onClick={() => fileInputRef.current?.click()}>Import</button>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </header>
  );
}
