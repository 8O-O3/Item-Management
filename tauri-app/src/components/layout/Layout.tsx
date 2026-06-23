import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import Sidebar from '@/components/sidebar/Sidebar';
import Board from '@/components/board/Board';
import ChatPanel, { ChatFAB } from '@/components/chat/ChatPanel';
import Header from '@/components/layout/Header';
import Toast from '@/components/layout/Toast';
import ModalRenderer from '@/components/modals/ModalRenderer';
import ApiConfigForm from '@/components/settings/ApiConfigForm';

export default function Layout() {
  const sidebarMode = useAppStore((s) => s.sidebarMode);
  const currentProject = useAppStore((s) => s.currentProject);
  const editingConfigId = useSettingsStore((s) => s.editingConfigId);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Header />
      {/* Main area — below Header, fills remaining height */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-h-0 overflow-y-auto">
          {editingConfigId !== null ? (
            <ApiConfigEditor />
          ) : currentProject ? (
            <Board />
          ) : (
            <EmptyState />
          )}
        </main>
        {/* ChatPanel: absolute overlay within this row (below Header only) */}
        <ChatPanel />
      </div>
      <ModalRenderer />
      <Toast />
      <ChatFAB />
    </div>
  );
}

function ApiConfigEditor() {
  const editingConfigId = useSettingsStore((s) => s.editingConfigId);
  const setEditingConfig = useSettingsStore((s) => s.setEditingConfig);

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text">
          {editingConfigId && editingConfigId > 0 ? 'Edit API Configuration' : 'New API Configuration'}
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure an OpenAI-compatible API endpoint for AI chat features.
        </p>
      </div>
      <div className="glass rounded-card p-6">
        <ApiConfigForm editingId={editingConfigId} onClose={() => setEditingConfig(null)} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-text-secondary gap-5">
      <div className="w-20 h-20 rounded-2xl bg-surface border border-border flex items-center justify-center text-3xl opacity-40 shadow-sm select-none">□</div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-text mb-1.5">Select or create a project</h3>
        <p className="text-sm text-text-secondary leading-relaxed max-w-xs">Choose a folder from the sidebar or create<br />a new project to get started.</p>
      </div>
    </div>
  );
}
