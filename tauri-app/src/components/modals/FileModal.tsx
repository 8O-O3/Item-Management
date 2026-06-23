import { useState, useRef, useCallback, useEffect } from 'react';
import Modal from './Modal';
import { useAppStore } from '@/stores/appStore';
import { closeModal, modalStore, openPreviewModal } from './modalStore';
import { nodesApi, systemApi } from '@/api';
import { formatSize } from '@/utils/format';

export default function FileModal() {
  const active = modalStore((s) => s.active);
  const editId = modalStore((s) => s.editId);
  const currentNodes = useAppStore((s) => s.currentNodes);
  const refreshNodes = useAppStore((s) => s.refreshNodes);
  const [pendingFiles, setPendingFiles] = useState<Array<{ name: string; size: number; data: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedNodeIdx, setExpandedNodeIdx] = useState<number | null>(null);

  // Sync expandedNodeIdx from store when modal opens (component is always mounted)
  useEffect(() => {
    if (active === 'file') {
      setExpandedNodeIdx(editId);
    }
  }, [active, editId]);

  const node = expandedNodeIdx != null ? currentNodes[expandedNodeIdx] : null;

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPending: Array<{ name: string; size: number; data: string }> = [];
    for (const file of files) {
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newPending.push({ name: file.name, size: file.size, data });
    }
    setPendingFiles((p) => [...p, ...newPending]);
    e.target.value = '';
  }, []);

  const handleConfirm = async () => {
    if (!node?.id) return;
    for (const f of pendingFiles) {
      await nodesApi.addFileToNode(node.id, f.name, '', f.size, f.data);
    }
    await refreshNodes();
    setPendingFiles([]);
    closeModal();
  };

  const handleRemoveFile = async (fileIdx: number) => {
    if (!node?.id) return;
    await nodesApi.removeFileFromNode(node.id, fileIdx);
    await refreshNodes();
  };

  const handlePreview = async (fileIdx: number) => {
    if (!node?.id) return;
    try {
      const bytes = await nodesApi.readFileBytes(node.id, fileIdx);
      const file = node.files[fileIdx];
      // Try to render image
      if (file.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        const blob = new Blob([new Uint8Array(bytes)]);
        const url = URL.createObjectURL(blob);
        openPreviewModal(file.name, `<img src="${url}" class="max-w-full max-h-[60vh] rounded-lg" />`, () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        });
      } else {
        const text = new TextDecoder().decode(new Uint8Array(bytes));
        openPreviewModal(file.name, `<pre class="text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto text-left">${text.replace(/[&<>"']/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))}</pre>`);
      }
    } catch (e) {
      console.error('Preview failed:', e);
    }
  };

  if (active !== 'file') return null;

  return (
    <>
      {/* Node selector when no node is selected */}
      {!node ? (
        <Modal open={true} onClose={closeModal} title="Select a Node">
          <div className="max-h-60 overflow-y-auto mb-4">
            {currentNodes.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-4">No nodes in current project</p>
            ) : (
              currentNodes.map((n, idx) => (
                <button
                  key={n.id}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-text hover:bg-surface transition"
                  onClick={() => setExpandedNodeIdx(idx)}
                >
                  {n.title}
                  <span className="text-text-secondary ml-2">({n.files.length} files)</span>
                </button>
              ))
            )}
          </div>
        </Modal>
      ) : (
        <Modal open={true} onClose={() => { setExpandedNodeIdx(null); closeModal(); }} title={`Files — ${node.title}`} wide>
          {/* Upload zone */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent/30 transition mb-4"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dt = e.dataTransfer;
              if (dt.files) {
                const input = fileInputRef.current;
                if (input) {
                  const list = new DataTransfer();
                  Array.from(dt.files).forEach((f) => list.items.add(f));
                  input.files = list.files;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }
            }}
          >
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <div className="text-2xl mb-2">[+]</div>
            <div className="text-sm text-text-secondary">Drag files here, or <strong className="text-accent">click to upload</strong></div>
          </div>

          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-text-secondary uppercase mb-2">Pending</div>
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-text bg-accent/5 mb-1">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-text-secondary text-xs">{formatSize(f.size)}</span>
                  <button className="text-danger text-xs" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Existing files */}
          {node.files.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-text-secondary uppercase mb-2">Files</div>
              {node.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-text hover:bg-surface transition mb-1 group cursor-pointer"
                  onClick={() => handlePreview(i)}>
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-text-secondary text-xs">{f.size ? formatSize(f.size) : ''}</span>
                  <button className="text-danger text-xs opacity-0 group-hover:opacity-100 transition"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn-ghost px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface transition" onClick={() => { setExpandedNodeIdx(null); closeModal(); }}>Cancel</button>
            <button className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-hover transition" onClick={handleConfirm} disabled={pendingFiles.length === 0}>
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
