import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import TreeView from './TreeView';
import ChatSessionList from './ChatSessionList';
import Settings from '@/components/settings/Settings';

export default function Sidebar() {
  const sidebarMode = useAppStore((s) => s.sidebarMode);
  const setSidebarMode = useAppStore((s) => s.setSidebarMode);

  return (
    <aside className="w-64 shrink-0 glass flex flex-col border-r border-border overflow-hidden">
      {sidebarMode === 'settings' ? (
        <div className="flex-1 overflow-y-auto min-h-0 p-3">
          <Settings />
        </div>
      ) : (
        <>
          {/* Explorer section — independently scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3 pb-2">
            <TreeView />
          </div>

          {/* Subtle divider */}
          <div className="mx-3 border-t border-border/50 shrink-0" />

          {/* Chats section — independently scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3 pt-2">
            <ChatSessionList />
          </div>
        </>
      )}

      {/* Settings toggle — always fixed at bottom */}
      <div className="shrink-0 p-2 border-t border-border">
        <button
          className="w-full text-xs py-1.5 rounded-lg bg-surface/50 hover:bg-surface text-text-secondary hover:text-accent transition"
          onClick={() => setSidebarMode(sidebarMode === 'settings' ? 'tree' : 'settings')}
          title="Settings"
        >
          {sidebarMode === 'settings' ? '← Explorer' : '⚙ Settings'}
        </button>
      </div>
    </aside>
  );
}
