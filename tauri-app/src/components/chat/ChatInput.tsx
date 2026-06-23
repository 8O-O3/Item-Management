import { useRef, useCallback, useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatSize } from '@/utils/format';

export default function ChatInput() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const isLoading = useChatStore((s) => s.isLoading);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);
  const attachments = useChatStore((s) => s.attachments);
  const configs = useSettingsStore((s) => s.apiConfigs);
  const selectedId = useSettingsStore((s) => s.selectedApiConfigId);
  const selectConfig = useSettingsStore((s) => s.selectConfig);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim();
    if (!text || isLoading) return;
    const config = configs.find((c) => c.id === selectedId);
    if (!config) return;
    sendMessage(text, config);
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
    }
  }, [isLoading, configs, selectedId, sendMessage]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addAttachment(file);
    }
    e.target.value = '';
  }, [addAttachment]);

  return (
    <div className="shrink-0 p-3 border-t border-border">
      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {attachments.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent/5 text-accent border border-accent/15">
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button className="hover:text-danger transition" onClick={() => removeAttachment(i)}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* ≡ Menu button — replaces the old + button */}
        <div className="relative shrink-0">
          <button
            ref={menuBtnRef}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition text-lg"
            onClick={() => setMenuOpen(!menuOpen)}
            title="Menu"
          >≡</button>

          {menuOpen && (
            <div ref={menuRef} className="absolute bottom-full left-0 mb-2 w-64 bg-surface border border-border rounded-xl shadow-modal p-3 z-50">
              {/* Attachments */}
              <div className="mb-3">
                <div className="text-[10px] font-semibold text-text-secondary uppercase mb-1.5">Attachments</div>
                {attachments.length === 0 ? (
                  <div className="text-xs text-text-secondary mb-1.5">No attachments</div>
                ) : (
                  <div className="space-y-1 mb-1.5 max-h-32 overflow-y-auto">
                    {attachments.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-text px-1.5 py-1 rounded hover:bg-bg transition group">
                        <span className="truncate flex-1">{f.name}</span>
                        <span className="text-text-secondary">{formatSize(f.size)}</span>
                        <button className="text-danger opacity-0 group-hover:opacity-100 text-xs" onClick={() => removeAttachment(i)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="text-xs text-accent hover:text-accent-hover" onClick={() => fileInputRef.current?.click()}>+ Add files</button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              </div>

              {/* Divider */}
              <div className="border-t border-border mb-3" />

              {/* Model selector */}
              <div>
                <div className="text-[10px] font-semibold text-text-secondary uppercase mb-1.5">Model</div>
                {configs.length === 0 ? (
                  <div className="text-xs text-text-secondary">No API configs</div>
                ) : (
                  configs.map((c) => (
                    <button
                      key={c.id}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 transition ${
                        c.id === selectedId ? 'bg-accent/10 text-accent font-medium' : 'text-text hover:bg-surface'
                      }`}
                      onClick={() => { selectConfig(c.id!); setMenuOpen(false); }}
                    >
                      <div className="truncate">{c.name}</div>
                      <div className="text-text-secondary text-[10px]">{c.model}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm bg-surface border border-border text-text placeholder-text-secondary outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition"
          placeholder="Ask about your project..."
          rows={1}
          onKeyDown={handleKey}
          onInput={handleInput}
        />

        <button
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-150 ${
            isLoading
              ? 'bg-danger text-white hover:bg-danger-hover'
              : 'bg-accent text-white hover:bg-accent-hover shadow-sm hover:shadow-md'
          }`}
          onClick={isLoading ? stopStreaming : handleSend}
          title={isLoading ? 'Stop' : 'Send'}
        >
          {isLoading ? '■' : '↑'}
        </button>
      </div>
    </div>
  );
}
