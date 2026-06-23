import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatSize } from '@/utils/format';

export default function ChatMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = useChatStore((s) => s.attachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);
  const configs = useSettingsStore((s) => s.apiConfigs);
  const selectedId = useSettingsStore((s) => s.selectedApiConfigId);
  const selectConfig = useSettingsStore((s) => s.selectConfig);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addAttachment(file);
    }
    e.target.value = '';
  }, [addAttachment]);

  return (
    <div className="shrink-0 px-3 pb-1.5 relative">
      <button
        ref={btnRef}
        className="text-text-secondary hover:text-text text-lg px-1 rounded transition"
        onClick={() => setIsOpen(!isOpen)}
        title="Menu"
      >≡</button>

      {isOpen && (
        <div ref={menuRef} className="absolute bottom-full left-3 mb-1 w-72 bg-surface border border-border rounded-xl shadow-modal p-3 z-50">
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
              <div className="text-xs text-text-secondary">No API configs — add one in Settings</div>
            ) : (
              configs.map((c) => (
                <button
                  key={c.id}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 transition ${
                    c.id === selectedId ? 'bg-accent/10 text-accent font-medium' : 'text-text hover:bg-surface'
                  }`}
                  onClick={() => { selectConfig(c.id!); setIsOpen(false); }}
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
  );
}
