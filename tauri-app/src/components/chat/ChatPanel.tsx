import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '@/stores/chatStore';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import ContextPicker from './ContextPicker';

export default function ChatPanel() {
  const isOpen = useChatStore((s) => s.isPanelOpen);
  const closePanel = useChatStore((s) => s.closePanel);
  const messages = useChatStore((s) => s.messages);
  const contextSelections = useChatStore((s) => s.contextSelections);
  const clearChat = useChatStore((s) => s.clearChat);
  const panelRef = useRef<HTMLDivElement>(null);

  const selCount = contextSelections.folderIds.length + contextSelections.projectIds.length + contextSelections.nodeIds.length;

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-20 bg-black/15 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        onClick={closePanel}
      />

      {/* Panel — slides in from right */}
      <div
        ref={panelRef}
        className={`absolute right-0 top-0 bottom-0 w-[420px] z-30 glass flex flex-col border-l border-border shadow-modal ${
          isOpen ? 'translate-x-0' : 'translate-x-full invisible'
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          transitionProperty: 'translate, visibility',
          transitionDuration: '350ms',
          transitionBehavior: 'allow-discrete',
        }}
        tabIndex={-1}
        onKeyDown={(e) => { if (e.key === 'Escape') closePanel(); }}
      >
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-3">
          <span className="font-semibold text-text text-sm">AI Chat</span>
          <ContextPicker>
            <span className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition ${
              selCount > 0 ? 'bg-accent/10 text-accent' : 'bg-surface text-text-secondary'
            }`}>
              Context: {selCount > 0 ? `${selCount} item${selCount > 1 ? 's' : ''}` : 'none'}
            </span>
          </ContextPicker>
          <div className="flex-1" />
          <button className="text-text-secondary hover:text-text text-sm px-1" onClick={clearChat} title="Clear">↻</button>
          <button className="text-text-secondary hover:text-text text-lg px-1" onClick={closePanel} title="Close">×</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-secondary gap-4 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-2xl opacity-30 shadow-sm">AI</div>
              <div>
                <h4 className="font-semibold text-text mb-1.5">Project Assistant</h4>
                <p className="text-xs leading-relaxed text-text-secondary">Ask questions about your projects,<br />get summaries, or discuss your work.</p>
              </div>
            </div>
          ) : (
            <ChatMessages />
          )}
        </div>
        <ChatInput />
      </div>
    </>
  );
}

/* ── FAB button ─────── */
export function ChatFAB() {
  const isOpen = useChatStore((s) => s.isPanelOpen);
  const openPanel = useChatStore((s) => s.openPanel);

  if (isOpen) return null;

  return createPortal(
    <button
      className="fixed bottom-5 right-5 z-[10000] w-12 h-12 rounded-full bg-accent text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center text-xs font-bold cursor-pointer select-none"
      onClick={openPanel}
      title="AI Chat"
      type="button"
    >
      AI
    </button>,
    document.body,
  );
}
