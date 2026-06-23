import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useChatStore } from '@/stores/chatStore';
import { chatApi } from '@/api';
import ContextMenu, { useContextMenu, type ContextMenuItem } from './ContextMenu';

export default function ChatSessionList() {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const loadSession = useChatStore((s) => s.loadSession);
  const newSession = useChatStore((s) => s.newSession);
  const openPanel = useChatStore((s) => s.openPanel);
  const selectProjectById = useAppStore((s) => s.selectProjectById);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const { menu, show, close } = useContextMenu();

  const handleSelect = useCallback(async (sessionId: number) => {
    await loadSession(sessionId);
    openPanel();
    const session = useChatStore.getState().sessions.find((s) => s.id === sessionId);
    if (session?.context_json) {
      try {
        const ctx = JSON.parse(session.context_json);
        if (ctx.projectIds?.length > 0) {
          await selectProjectById(ctx.projectIds[0]);
        }
      } catch { /* ignore */ }
    }
  }, [loadSession, openPanel, selectProjectById]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await chatApi.deleteChatSession(id);
      const remaining = sessions.filter((s) => s.id !== id);
      useChatStore.setState({ sessions: remaining });
      if (currentSessionId === id) {
        useChatStore.setState({ currentSessionId: null, messages: [] });
      }
    } catch (e) {
      console.error(e);
    }
    setConfirmDeleteId(null);
  }, [sessions, currentSessionId]);

  const getMenu = useCallback((id: number): ContextMenuItem[] => [
    { label: 'Rename', action: () => setRenamingId(id) },
    { label: 'Delete', danger: true, action: () => setConfirmDeleteId(id) },
  ], []);

  return (
    <div className="sidebar-section">
      <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-2 mb-2">Chats</div>
      <div id="chatSessionList">
        {sessions.length === 0 ? (
          <div className="text-xs text-text-secondary px-2 py-2">No chats yet</div>
        ) : (
          sessions.map((s) => (
            <ChatSessionItem
              key={s.id}
              session={s}
              isActive={s.id === currentSessionId}
              isRenaming={s.id === renamingId}
              isConfirmDelete={s.id === confirmDeleteId}
              onSelect={() => handleSelect(s.id)}
              onRenameConfirm={async (title) => {
                await chatApi.updateChatSession(s.id, title, s.model_config_id, s.context_json);
                useChatStore.setState({
                  sessions: useChatStore.getState().sessions.map((ss) =>
                    ss.id === s.id ? { ...ss, title } : ss,
                  ),
                });
                setRenamingId(null);
              }}
              onRenameCancel={() => setRenamingId(null)}
              onDeleteConfirm={() => handleDelete(s.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              onContextMenu={(x, y) => show(getMenu(s.id), x, y)}
            />
          ))
        )}
      </div>
      <button
        className="w-full text-xs py-1 mt-2 rounded-md bg-surface hover:bg-accent/10 text-text-secondary hover:text-accent transition"
        onClick={() => { newSession(); openPanel(); }}
      >+ New Chat</button>
      {menu && <ContextMenu items={menu.items} x={menu.x} y={menu.y} onClose={close} />}
    </div>
  );
}

function ChatSessionItem({
  session, isActive, isRenaming, isConfirmDelete,
  onSelect, onRenameConfirm, onRenameCancel, onDeleteConfirm, onDeleteCancel, onContextMenu,
}: {
  session: { id: number; title: string };
  isActive: boolean;
  isRenaming: boolean;
  isConfirmDelete: boolean;
  onSelect: () => void;
  onRenameConfirm: (title: string) => void;
  onRenameCancel: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  if (isConfirmDelete) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-danger/5 border border-danger/15 mb-0.5">
        <span className="flex-1 text-xs text-danger truncate">Delete "{session.title}"?</span>
        <button
          className="text-xs px-1.5 py-0.5 rounded font-medium text-white bg-danger hover:bg-danger-hover transition"
          onClick={(e) => { e.stopPropagation(); onDeleteConfirm(); }}
        >Yes</button>
        <button
          className="text-xs px-1.5 py-0.5 rounded text-text-secondary hover:text-text transition"
          onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
        >No</button>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md text-sm transition ${
        isActive ? 'bg-accent/10 text-accent' : 'text-text hover:bg-surface'
      }`}
      onClick={() => { if (!isRenaming) onSelect(); }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
    >
      {isRenaming ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-sm bg-bg border border-accent text-text outline-none"
          defaultValue={session.title}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onRenameConfirm((e.target as HTMLInputElement).value.trim()); }
            else if (e.key === 'Escape') { e.preventDefault(); onRenameCancel(); }
          }}
          onBlur={() => setTimeout(onRenameCancel, 150)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="flex-1 truncate">{session.title}</span>
          <button
            className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-text-secondary hover:text-accent hover:bg-surface transition text-sm font-bold"
            onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); onContextMenu(r.left, r.bottom); }}
            title="More actions"
          >…</button>
        </>
      )}
    </div>
  );
}
