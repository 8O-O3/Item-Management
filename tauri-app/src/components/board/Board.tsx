import { useAppStore } from '@/stores/appStore';
import { useChatStore } from '@/stores/chatStore';
import { nodesApi } from '@/api';
import { openModal, openFileModal, confirmDelete, openPreviewModal } from '@/components/modals/modalStore';
import { formatSize, formatTime } from '@/utils/format';
import { useState, useRef, useEffect, useCallback } from 'react';

export default function Board() {
  const currentProject = useAppStore((s) => s.currentProject);
  const currentNodes = useAppStore((s) => s.currentNodes);
  const expandedNodes = useAppStore((s) => s.expandedNodes);
  const toggleNodeExpand = useAppStore((s) => s.toggleNodeExpand);
  const refreshNodes = useAppStore((s) => s.refreshNodes);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const folders = useAppStore((s) => s.folders);

  const [isCreating, setIsCreating] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const newNodeTitleRef = useRef('');
  const createInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the inline create input when it appears
  useEffect(() => {
    if (isCreating) {
      const raf = requestAnimationFrame(() => {
        createInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isCreating]);

  const breadcrumb: string[] = [];
  if (currentFolder) {
    let f = folders.find((x) => x.id === currentFolder);
    while (f) {
      breadcrumb.unshift(f.name);
      f = f.parent_id ? folders.find((x) => x.id === f!.parent_id) : undefined;
    }
    breadcrumb.unshift('All');
  } else {
    breadcrumb.push('All');
  }
  if (currentProject) breadcrumb.push(currentProject.name);

  // Ref-based handler avoids stale closures — always reads latest currentProject/refreshNodes
  const handleCreateNodeRef = useRef<(() => Promise<void>) | null>(null);
  handleCreateNodeRef.current = async () => {
    const title = newNodeTitleRef.current.trim();
    if (!title) return;
    const project = useAppStore.getState().currentProject;
    if (!project?.id) return;
    try {
      await nodesApi.createNode(project.id, title);
      newNodeTitleRef.current = '';
      setNewNodeTitle('');
      setIsCreating(false);
      await refreshNodes();
    } catch (e) {
      console.error('Failed to create node:', e);
    }
  };

  const onCreateConfirm = useCallback(() => {
    handleCreateNodeRef.current?.();
  }, []);

  const startCreating = useCallback(() => {
    newNodeTitleRef.current = '';
    setNewNodeTitle('');
    setIsCreating(true);
  }, []);

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="text-[13px] text-text-secondary mb-5 select-none">
        {breadcrumb.map((seg, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1.5 text-border">/</span>}
            <span className={i === breadcrumb.length - 1 ? 'text-text font-medium' : ''}>{seg}</span>
          </span>
        ))}
      </div>

      {/* Nodes */}
      <div className="flex flex-col gap-3.5">
        {currentNodes.map((node, idx) => (
          <NodeCard
            key={node.id ?? idx}
            node={node}
            idx={idx}
            isExpanded={expandedNodes.has(node.id!)}
            onToggle={() => toggleNodeExpand(node.id!)}
            onDelete={() => confirmDelete('node', node.id!)}
            onEdit={() => openModal('node', node.id!)}
            onChatWithNode={() => {
              useChatStore.getState().newSession(currentProject ?? undefined);
              useChatStore.getState().setContextSelections({ folderIds: [], projectIds: currentProject ? [currentProject.id] : [], nodeIds: node.id ? [node.id] : [] });
              useChatStore.getState().openPanel();
            }}
            onRefresh={refreshNodes}
          />
        ))}
        {currentNodes.length === 0 && !isCreating && (
          <div className="text-center text-text-secondary text-sm py-12 select-none">No nodes yet. Add one to get started.</div>
        )}
      </div>

      {/* Inline node creation */}
      {isCreating && (
        <div className="glass rounded-card p-4 mt-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm shadow-lg shadow-accent/25">+</div>
          <input
            ref={createInputRef}
            className="flex-1 bg-transparent text-text text-sm outline-none placeholder-text-secondary"
            placeholder="Node title — press Enter to create"
            value={newNodeTitle}
            onChange={(e) => { setNewNodeTitle(e.target.value); newNodeTitleRef.current = e.target.value; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreateConfirm();
              if (e.key === 'Escape') { setIsCreating(false); setNewNodeTitle(''); }
            }}
            autoComplete="off"
          />
          <button className="text-xs text-text-secondary hover:text-text px-2 py-1" onClick={() => { setIsCreating(false); setNewNodeTitle(''); }}>Cancel</button>
        </div>
      )}

      {/* Add Node button */}
      {!isCreating && (
        <button
          className="mt-4 w-full py-2.5 rounded-xl border-2 border-dashed border-border text-text-secondary text-sm hover:border-accent/25 hover:text-accent hover:bg-accent/[0.03] transition-all duration-200"
          onClick={startCreating}
        >+ Add Node</button>
      )}
    </div>
  );
}

function NodeCard({
  node, idx, isExpanded, onToggle, onDelete, onEdit, onChatWithNode, onRefresh,
}: {
  node: ReturnType<typeof useAppStore.getState>['currentNodes'][0];
  idx: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onChatWithNode: () => void;
  onRefresh: () => void;
}) {
  const fileCount = node.files?.length ?? 0;
  const timelineCount = node.timeline?.length ?? 0;

  // Inline timeline creation state
  const [isAddingTimeline, setIsAddingTimeline] = useState(false);
  const [timelineContent, setTimelineContent] = useState('');
  const timelineContentRef = useRef('');
  const timelineInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isAddingTimeline) {
      const raf = requestAnimationFrame(() => {
        timelineInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isAddingTimeline]);

  const handleAddTimelineRef = useRef<(() => Promise<void>) | null>(null);
  handleAddTimelineRef.current = async () => {
    const content = timelineContentRef.current.trim();
    if (!content || !node.id) return;
    try {
      await nodesApi.addTimelineEntry(node.id, content);
      timelineContentRef.current = '';
      setTimelineContent('');
      setIsAddingTimeline(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to add timeline:', e);
    }
  };

  const onTimelineConfirm = useCallback(() => {
    handleAddTimelineRef.current?.();
  }, []);

  const handlePreviewFile = useCallback(async (nodeId: number, fileIdx: number, name: string) => {
    try {
      const bytes = await nodesApi.readFileBytes(nodeId, fileIdx);
      if (name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        const blob = new Blob([new Uint8Array(bytes)]);
        const url = URL.createObjectURL(blob);
        openPreviewModal(name, `<img src="${url}" class="max-w-full max-h-[60vh] rounded-lg" />`, () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        });
      } else {
        const text = new TextDecoder().decode(new Uint8Array(bytes));
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        openPreviewModal(name, `<pre class="text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto text-left bg-bg rounded-lg p-3">${escaped}</pre>`);
      }
    } catch (e) {
      console.error('Preview failed:', e);
    }
  }, []);

  const handleDownloadFile = useCallback(async (nodeId: number, fileIdx: number, name: string) => {
    try {
      const bytes = await nodesApi.readFileBytes(nodeId, fileIdx);
      const blob = new Blob([new Uint8Array(bytes)]);
      const dataUrl = URL.createObjectURL(blob);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          if (window.__TAURI__?.dialog?.save) {
            const path = await window.__TAURI__.dialog.save({ defaultPath: name });
            if (!path) return;
            await nodesApi.saveNodeFile(reader.result as string, path);
          }
        } catch (err) {
          console.error('Download failed:', err);
        }
      };
      reader.readAsDataURL(blob);
      URL.revokeObjectURL(dataUrl);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }, []);

  return (
    <div className={`rounded-card overflow-hidden transition-all duration-[350ms] ease-out select-none ${
      isExpanded
        ? 'glass-surface shadow-depth-lg -translate-y-0.5'
        : 'glass-surface hover:shadow-depth-lg hover:-translate-y-[1px]'
    }`}>
      <div
        className="flex items-center gap-3.5 px-5 py-4 cursor-pointer hover:bg-surface/50 transition-colors duration-150 group"
        onClick={onToggle}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-500 ease-out ${
          isExpanded ? 'bg-accent text-white rotate-90 shadow-lg shadow-accent/25' : 'bg-surface text-text-secondary group-hover:text-accent group-hover:bg-accent/5'
        }`}>
          &#9654;
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-text truncate">{node.title}</div>
          {node.desc && !isExpanded && (
            <div className="text-[13px] text-text-secondary mt-0.5 truncate">{node.desc}</div>
          )}
        </div>
        <div className="flex gap-4 items-center">
          {fileCount > 0 && <span className="text-xs text-text-secondary">{fileCount} files</span>}
          {timelineCount > 0 && <span className="text-xs text-text-secondary">{timelineCount} timeline</span>}
          <button
            className="text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-danger/10 text-danger"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >Delete</button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 py-5 bg-surface/70 border-t border-border">
          {node.desc && (
            <p className="text-sm text-text-secondary mb-5 leading-relaxed">{node.desc}</p>
          )}

          <NodeSection label="Files" count={fileCount} onAdd={() => openFileModal(idx)}>
            {node.files?.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-text-secondary hover:bg-bg transition group/file cursor-pointer"
                onClick={() => node.id && handlePreviewFile(node.id, i, file.name)}
              >
                <span className="truncate flex-1">{file.name}</span>
                {file.size != null && <span className="text-xs text-text-secondary shrink-0">{formatSize(file.size)}</span>}
                <span className="text-xs text-text-secondary shrink-0">{formatTime(file.added_at)}</span>
                <button
                  className="text-xs text-accent opacity-0 group-hover/file:opacity-100 transition shrink-0 hover:text-accent-hover"
                  onClick={(e) => { e.stopPropagation(); node.id && handleDownloadFile(node.id, i, file.name); }}
                  title="Download"
                >↓</button>
              </div>
            ))}
          </NodeSection>

          {/* Timeline section with multi-line textarea and editing */}
          <div className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[11px] font-semibold text-text-secondary uppercase">Timeline</div>
              {timelineCount > 0 && <span className="text-[11px] text-text-secondary">({timelineCount})</span>}
            </div>
            {timelineCount > 0 ? (
              <div className="space-y-1.5">
                {node.timeline?.map((entry, i) => (
                  <TimelineEntryRow
                    key={i}
                    nodeId={node.id!}
                    entryIdx={i}
                    entry={entry}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            ) : !isAddingTimeline ? (
              <div className="text-xs text-text-secondary py-2">No timeline yet</div>
            ) : null}
            {isAddingTimeline && (
              <div className="mt-2">
                <textarea
                  ref={timelineInputRef}
                  className="w-full bg-bg rounded-lg px-3 py-2 text-sm text-text outline-none border border-border focus:border-accent/40 transition resize-none"
                  placeholder="Timeline entry... Ctrl+Enter to save"
                  rows={3}
                  value={timelineContent}
                  onChange={(e) => { setTimelineContent(e.target.value); timelineContentRef.current = e.target.value; }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      onTimelineConfirm();
                    }
                    if (e.key === 'Escape') { setIsAddingTimeline(false); setTimelineContent(''); }
                  }}
                  autoComplete="off"
                />
                <div className="flex justify-end gap-2 mt-1.5">
                  <button className="text-xs text-text-secondary hover:text-text px-2 py-1"
                    onClick={() => { setIsAddingTimeline(false); setTimelineContent(''); }}>Cancel</button>
                  <button className="text-xs bg-accent text-white px-3 py-1 rounded-lg hover:bg-accent-hover transition"
                    onClick={onTimelineConfirm}>Save</button>
                </div>
              </div>
            )}
            {!isAddingTimeline && (
              <button className="text-xs text-accent hover:text-accent-hover mt-1"
                onClick={() => { timelineContentRef.current = ''; setTimelineContent(''); setIsAddingTimeline(true); }}>
                + Add Entry
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-5 pt-3 border-t border-border">
            <button className="text-xs px-3.5 py-1.5 rounded-lg bg-surface hover:bg-accent/10 text-text-secondary hover:text-accent transition" onClick={onEdit}>Edit</button>
            <button className="text-xs px-3.5 py-1.5 rounded-lg bg-surface hover:bg-accent/10 text-text-secondary hover:text-accent transition" onClick={onChatWithNode}>Chat</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NodeSection({
  label, count, children, onAdd,
}: {
  label: string; count: number; children: React.ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[11px] font-semibold text-text-secondary uppercase">{label}</div>
        {count > 0 && <span className="text-[11px] text-text-secondary">({count})</span>}
        {onAdd && (
          <button className="text-[11px] text-accent hover:text-accent-hover ml-auto" onClick={onAdd}>+ Add</button>
        )}
      </div>
      {count > 0 ? (
        <div className="space-y-0.5">{children}</div>
      ) : (
        <div className="text-xs text-text-secondary py-2">No {label.toLowerCase()} yet</div>
      )}
    </div>
  );
}

/* ── Timeline entry row with edit/delete ─────────────────── */
function TimelineEntryRow({
  nodeId, entryIdx, entry, onRefresh,
}: {
  nodeId: number;
  entryIdx: number;
  entry: { content: string; time: string };
  onRefresh: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);
  const editContentRef = useRef(entry.content);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isEditing) {
      const raf = requestAnimationFrame(() => {
        const el = editInputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isEditing]);

  const handleSaveRef = useRef<(() => Promise<void>) | null>(null);
  handleSaveRef.current = async () => {
    const content = editContentRef.current.trim();
    if (!content) return;
    try {
      await nodesApi.updateTimelineEntry(nodeId, entryIdx, content);
      setEditContent(content);
      setIsEditing(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to update timeline:', e);
    }
  };

  const handleDelete = useCallback(async () => {
    try {
      await nodesApi.deleteTimelineEntry(nodeId, entryIdx);
      setConfirmDelete(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to delete timeline:', e);
    }
  }, [nodeId, entryIdx, onRefresh]);

  const firstLine = entry.content.split('\n')[0];

  return (
    <div className="group/tl px-2 py-1.5 rounded hover:bg-bg/70 transition">
      {isEditing ? (
        <div>
          <textarea
            ref={editInputRef}
            className="w-full bg-bg rounded-lg px-3 py-2 text-sm text-text outline-none border border-accent/40 transition resize-none"
            rows={3}
            value={editContent}
            onChange={(e) => { setEditContent(e.target.value); editContentRef.current = e.target.value; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSaveRef.current?.();
              }
              if (e.key === 'Escape') { setIsEditing(false); setEditContent(entry.content); }
            }}
            autoComplete="off"
          />
          <div className="flex justify-end gap-2 mt-1">
            <button className="text-xs text-text-secondary hover:text-text px-2 py-0.5"
              onClick={() => { setIsEditing(false); setEditContent(entry.content); }}>Cancel</button>
            <button className="text-xs bg-accent text-white px-3 py-0.5 rounded hover:bg-accent-hover transition"
              onClick={() => handleSaveRef.current?.()}>Save</button>
          </div>
        </div>
      ) : (
        <div>
          <span className="text-text-secondary text-xs mr-2 shrink-0">{formatTime(entry.time)}</span>
          <span className="text-text text-sm whitespace-pre-wrap">{firstLine}{entry.content.includes('\n') ? ' …' : ''}</span>
          <span className="ml-2 opacity-0 group-hover/tl:opacity-100 transition inline-flex gap-1">
            <button className="text-[11px] text-accent hover:text-accent-hover"
              onClick={() => { setEditContent(entry.content); editContentRef.current = entry.content; setIsEditing(true); }}>Edit</button>
            {confirmDelete ? (
              <span className="inline-flex gap-1 items-center">
                <span className="text-[10px] text-text-secondary">Delete?</span>
                <button className="text-[11px] text-danger font-semibold hover:text-danger-hover" onClick={handleDelete}>Yes</button>
                <button className="text-[11px] text-text-secondary hover:text-text" onClick={() => setConfirmDelete(false)}>No</button>
              </span>
            ) : (
              <button className="text-[11px] text-danger hover:text-danger-hover"
                onClick={() => setConfirmDelete(true)}>Del</button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
